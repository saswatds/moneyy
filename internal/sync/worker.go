package sync

import (
	"context"
	"fmt"
	"log"
	"strconv"
	"time"

	"money/internal/account"
	"money/internal/balance"
	"money/internal/holdings"
	"money/internal/sync/wealthsimple"
)

// performInitialSync performs the initial sync of accounts from Wealthsimple
func (s *Service) performInitialSync(ctx context.Context, userID, connectionID string) error {
	// Update connection status to syncing
	_, err := s.db.ExecContext(ctx, `
		UPDATE sync_credentials
		SET status = $1, updated_at = $2
		WHERE id = $3
	`, StatusSyncing, time.Now(), connectionID)
	if err != nil {
		return fmt.Errorf("failed to update connection status: %w", err)
	}

	// Defer function to update connection status on error
	defer func() {
		if r := recover(); r != nil {
			log.Printf("PANIC: sync panic recovered: connection_id=%s panic=%v", connectionID, r)
			_ = s.UpdateConnectionError(ctx, connectionID, fmt.Sprintf("sync panic: %v", r))
		}
	}()

	// Get authenticated client
	client, err := s.getDecryptedCredentials(ctx, userID)
	if err != nil {
		errMsg := fmt.Sprintf("failed to get credentials: %v", err)
		_ = s.UpdateConnectionError(ctx, connectionID, errMsg)
		return fmt.Errorf("%s", errMsg)
	}

	// Get identity ID from credentials
	var identityID string
	err = s.db.QueryRowContext(ctx, `
		SELECT identity_canonical_id
		FROM sync_credentials
		WHERE user_id = $1
	`, userID).Scan(&identityID)

	if err != nil || identityID == "" {
		errMsg := fmt.Sprintf("identity ID not found in credentials: %v", err)
		_ = s.UpdateConnectionError(ctx, connectionID, errMsg)
		return fmt.Errorf("%s", errMsg)
	}

	// Fetch accounts from Wealthsimple
	log.Printf("INFO: fetching accounts from wealthsimple: connection_id=%s identity_id=%s",
		connectionID, identityID)
	variables := map[string]interface{}{
		"identityId": identityID,
	}
	data, err := client.QueryGraphQL(ctx, wealthsimple.QueryListAccounts, variables, "trade")
	if err != nil {
		log.Printf("ERROR: failed to fetch accounts: %v", err)
		errMsg := fmt.Sprintf("failed to fetch accounts: %v", err)
		_ = s.UpdateConnectionError(ctx, connectionID, errMsg)
		return fmt.Errorf("%s", errMsg)
	}

	// Parse accounts from identity.accounts.edges structure
	identity, ok := data["identity"].(map[string]interface{})
	if !ok {
		errMsg := "invalid response format: no identity field"
		_ = s.UpdateConnectionError(ctx, connectionID, errMsg)
		return fmt.Errorf("%s", errMsg)
	}

	accountsData, ok := identity["accounts"].(map[string]interface{})
	if !ok {
		errMsg := "invalid response format: no accounts field"
		_ = s.UpdateConnectionError(ctx, connectionID, errMsg)
		return fmt.Errorf("%s", errMsg)
	}

	edges, ok := accountsData["edges"].([]interface{})
	if !ok {
		errMsg := "invalid response format: no edges field"
		_ = s.UpdateConnectionError(ctx, connectionID, errMsg)
		return fmt.Errorf("%s", errMsg)
	}

	log.Printf("INFO: processing account edges: count=%d", len(edges))

	accountCount := 0
	for _, edge := range edges {
		edgeMap, ok := edge.(map[string]interface{})
		if !ok {
			log.Printf("DEBUG: skipping non-map edge: %v", edge)
			continue
		}

		accountNode, ok := edgeMap["node"].(map[string]interface{})
		if !ok {
			log.Printf("DEBUG: skipping edge with no node: %v", edgeMap)
			continue
		}

		// Extract account data
		providerAccountID, _ := accountNode["id"].(string)
		nickname, _ := accountNode["nickname"].(string)
		accountType, _ := accountNode["type"].(string)
		currency, _ := accountNode["currency"].(string)
		status, _ := accountNode["status"].(string)

		log.Printf("INFO: processing account: provider_id=%s nickname=%s type=%s currency=%s status=%s",
			providerAccountID, nickname, accountType, currency, status)

		if status != "open" {
			log.Printf("INFO: skipping closed account: provider_id=%s status=%s", providerAccountID, status)
			continue // Skip closed accounts
		}

		// Map Wealthsimple account type to local type
		localAccountType := mapWealthsimpleAccountType(accountType)

		// Use account type as name if nickname is empty
		if nickname == "" {
			nickname = formatAccountTypeName(localAccountType)
		}

		// Check if this account is already synced
		var localAccountID string
		var syncedAccountID string
		err = s.db.QueryRowContext(ctx, `
			SELECT id, local_account_id
			FROM synced_accounts
			WHERE credential_id = $1 AND provider_account_id = $2
		`, connectionID, providerAccountID).Scan(&syncedAccountID, &localAccountID)

		if err == nil {
			// Account already exists, sync details
			log.Printf("INFO: account already synced, will update details: provider_account_id=%s local_account_id=%s synced_account_id=%s",
				providerAccountID, localAccountID, syncedAccountID)
		} else {
			// Account doesn't exist, create it
			// Determine if this is an asset or liability account
			isAsset := isAssetAccount(localAccountType)
			institution := "Wealthsimple"

			createdAccount, err := s.accountSvc.Create(ctx, &account.CreateAccountRequest{
				Name:         nickname,
				Type:         account.AccountType(localAccountType),
				Currency:     account.Currency(mapCurrency(currency)),
				Institution:  &institution,
				IsAsset:      isAsset,
				IsSynced:     true,
				ConnectionID: connectionID,
			})

			if err != nil {
				log.Printf("ERROR: failed to create local account: provider_account_id=%s error=%v",
					providerAccountID, err)
				continue
			}

			localAccountID = createdAccount.ID

			// Create synced account record and get its ID
			err = s.db.QueryRowContext(ctx, `
				INSERT INTO synced_accounts (
					credential_id, local_account_id, provider_account_id,
					created_at, updated_at
				) VALUES ($1, $2, $3, $4, $5)
				RETURNING id
			`, connectionID, localAccountID, providerAccountID, time.Now(), time.Now()).Scan(&syncedAccountID)

			if err != nil {
				log.Printf("ERROR: failed to create synced account: provider_account_id=%s error=%v",
					providerAccountID, err)
				continue
			}

			log.Printf("INFO: created new synced account: provider_account_id=%s local_account_id=%s synced_account_id=%s",
				providerAccountID, localAccountID, syncedAccountID)
		}

		// Create a sync job for this account
		log.Printf("INFO: creating sync job: synced_account_id=%s", syncedAccountID)
		jobID, err := s.createSyncJob(ctx, syncedAccountID, SyncJobTypeFull)
		if err != nil {
			log.Printf("ERROR: failed to create sync job: synced_account_id=%s error=%v",
				syncedAccountID, err)
			continue
		}
		log.Printf("INFO: created sync job: job_id=%s synced_account_id=%s", jobID, syncedAccountID)

		// Fetch account details (balances, positions)
		isAssetAcc := isAssetAccount(localAccountType)
		isCreditCard := localAccountType == "credit_card"
		log.Printf("INFO: syncing account details: provider_account_id=%s local_account_id=%s is_asset=%v is_credit_card=%v",
			providerAccountID, localAccountID, isAssetAcc, isCreditCard)

		if err := s.syncAccountDetails(ctx, client, providerAccountID, localAccountID, identityID, isAssetAcc, isCreditCard, jobID); err != nil {
			log.Printf("ERROR: failed to sync account details: provider_account_id=%s local_account_id=%s error=%v",
				providerAccountID, localAccountID, err)
			_ = s.completeSyncJob(ctx, jobID, SyncJobStatusFailed, err.Error())
		} else {
			log.Printf("INFO: successfully synced account details: provider_account_id=%s local_account_id=%s",
				providerAccountID, localAccountID)
			_ = s.completeSyncJob(ctx, jobID, SyncJobStatusCompleted, "")

			// Update synced_account timestamps
			_, err = s.db.ExecContext(ctx, `
				UPDATE synced_accounts
				SET last_sync_at = CURRENT_TIMESTAMP,
				    updated_at = CURRENT_TIMESTAMP
				WHERE id = $1
			`, syncedAccountID)
			if err != nil {
				log.Printf("ERROR: failed to update synced_account timestamps: synced_account_id=%s error=%v",
					syncedAccountID, err)
			}
		}

		accountCount++
	}

	log.Printf("INFO: finished processing accounts: total_accounts=%d connection_id=%s", accountCount, connectionID)

	// Update connection with success
	_, err = s.db.ExecContext(ctx, `
		UPDATE sync_credentials
		SET status = $1,
		    account_count = $2,
		    last_sync_at = $3,
		    last_sync_error = NULL,
		    updated_at = $4
		WHERE id = $5
	`, StatusConnected, accountCount, time.Now(), time.Now(), connectionID)

	return err
}

// syncAccountDetails fetches and stores account balances and positions
func (s *Service) syncAccountDetails(ctx context.Context, client *wealthsimple.Client, providerAccountID, localAccountID, identityID string, isAsset, isCreditCard bool, jobID string) error {
	// Credit cards use a different GraphQL endpoint
	if isCreditCard {
		return s.syncCreditCardDetails(ctx, client, providerAccountID, localAccountID, isAsset, jobID)
	}

	variables := map[string]interface{}{
		"ids": []string{providerAccountID},
	}

	log.Printf("INFO: fetching account details: provider_account_id=%s local_account_id=%s",
		providerAccountID, localAccountID)

	data, err := client.QueryGraphQL(ctx, wealthsimple.QueryFetchAccountDetails, variables, "trade")
	if err != nil {
		log.Printf("ERROR: failed to fetch account details: provider_account_id=%s error=%v",
			providerAccountID, err)
		return fmt.Errorf("failed to fetch account details: %w", err)
	}

	accounts, ok := data["accounts"].([]interface{})
	if !ok || len(accounts) == 0 {
		log.Printf("ERROR: invalid response format - no accounts field or empty: provider_account_id=%s data=%v",
			providerAccountID, data)
		return fmt.Errorf("invalid response format")
	}

	accountData, ok := accounts[0].(map[string]interface{})
	if !ok {
		log.Printf("ERROR: invalid account format: provider_account_id=%s", providerAccountID)
		return fmt.Errorf("invalid account format")
	}

	// Extract balance from financials
	var amount float64
	var foundBalance bool

	if financials, ok := accountData["financials"].(map[string]interface{}); ok {
		// For credit cards and other accounts, try currentBalance first
		if !isAsset {
			// Try currentBalance for liability accounts
			if currentBalance, ok := financials["currentBalance"].(map[string]interface{}); ok {
				log.Printf("DEBUG: found currentBalance for liability account: provider_account_id=%s currentBalance_keys=%v",
					providerAccountID, getMapKeys(currentBalance))

				if amountObj, ok := currentBalance["amount"].(string); ok {
					parsedAmount, err := strconv.ParseFloat(amountObj, 64)
					if err == nil {
						amount = parsedAmount
						foundBalance = true
						log.Printf("INFO: found balance from currentBalance: provider_account_id=%s amount=%f",
							providerAccountID, amount)
					}
				}
			}
		}

		// If not found yet, try netLiquidationValue (for investment accounts)
		if !foundBalance {
			if currentCombined, ok := financials["currentCombined"].(map[string]interface{}); ok {
				log.Printf("DEBUG: found currentCombined: provider_account_id=%s currentCombined_keys=%v",
					providerAccountID, getMapKeys(currentCombined))

				if netLiquidationValue, ok := currentCombined["netLiquidationValueV2"].(map[string]interface{}); ok {
					// Amount comes as a string, need to parse it
					amountStr, ok := netLiquidationValue["amount"].(string)
					if !ok {
						log.Printf("DEBUG: amount is not a string, trying float64: provider_account_id=%s",
							providerAccountID)
						// Try as float64 in case API changes
						if amountFloat, ok := netLiquidationValue["amount"].(float64); ok {
							amountStr = fmt.Sprintf("%f", amountFloat)
						}
					}

					if amountStr != "" {
						parsedAmount, err := strconv.ParseFloat(amountStr, 64)
						if err == nil {
							amount = parsedAmount
							foundBalance = true
							log.Printf("INFO: found balance from netLiquidationValue: provider_account_id=%s amount=%f",
								providerAccountID, amount)
						}
					}
				} else {
					log.Printf("DEBUG: no netLiquidationValueV2 found: provider_account_id=%s", providerAccountID)
				}
			} else {
				log.Printf("DEBUG: no currentCombined found: provider_account_id=%s", providerAccountID)
			}
		}

		// If still not found, log all available keys for debugging
		if !foundBalance {
			log.Printf("WARN: could not find balance in any known location: provider_account_id=%s financials_keys=%v is_asset=%v",
				providerAccountID, getMapKeys(financials), isAsset)
		}
	} else {
		log.Printf("DEBUG: no financials field found: provider_account_id=%s", providerAccountID)
	}

	// Create balance entry if we found one
	if foundBalance {
		// For liability accounts (credit cards, loans), negate the balance
		// because they represent debt
		if !isAsset {
			amount = -amount
		}

		// Truncate to just the date (no time component) for proper upsert
		now := time.Now()
		today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())

		// Create or update balance via balance service
		balanceResp, err := s.balanceSvc.Create(ctx, &balance.CreateBalanceRequest{
			AccountID: localAccountID,
			Amount:    amount,
			Date:      today,
			Notes:     "Synced from Wealthsimple",
		})

		if err != nil {
			log.Printf("ERROR: failed to create balance: account_id=%s amount=%f error=%v",
				localAccountID, amount, err)
			_ = s.updateSyncJobProgress(ctx, jobID, 1, 0, 0, 1)
		} else {
			// Track created vs updated
			if balanceResp.WasUpdate {
				log.Printf("INFO: updated balance: balance_id=%s account_id=%s amount=%f",
					balanceResp.Balance.ID, localAccountID, amount)
				_ = s.updateSyncJobProgress(ctx, jobID, 1, 0, 1, 0)
			} else {
				log.Printf("INFO: created balance: balance_id=%s account_id=%s amount=%f",
					balanceResp.Balance.ID, localAccountID, amount)
				_ = s.updateSyncJobProgress(ctx, jobID, 1, 1, 0, 0)
			}
		}
	} else {
		log.Printf("WARN: no balance found for account: provider_account_id=%s local_account_id=%s",
			providerAccountID, localAccountID)
	}

	// Fetch positions using identity-based query
	log.Printf("INFO: fetching account positions: provider_account_id=%s local_account_id=%s identity_id=%s",
		providerAccountID, localAccountID, identityID)

	positionsVariables := map[string]interface{}{
		"identityId": identityID,
		"currency":   "CAD",
		"accountIds": []string{providerAccountID},
		"first":      500,
	}

	positionsData, err := client.QueryGraphQL(ctx, wealthsimple.QueryFetchAccountPositions, positionsVariables, "trade")
	if err != nil {
		log.Printf("ERROR: failed to fetch positions: provider_account_id=%s error=%v",
			providerAccountID, err)
		// Don't return error, balances already synced
		return nil
	}

	log.Printf("DEBUG: positions response keys: provider_account_id=%s keys=%v",
		providerAccountID, getMapKeys(positionsData))

	// Parse positions response: identity.financials.current.positions.edges
	identity, ok := positionsData["identity"].(map[string]interface{})
	if !ok {
		log.Printf("WARN: no identity in positions response: provider_account_id=%s data=%v",
			providerAccountID, positionsData)
		return nil
	}

	financials, ok := identity["financials"].(map[string]interface{})
	if !ok {
		log.Printf("DEBUG: no financials in positions response: provider_account_id=%s", providerAccountID)
		return nil
	}

	current, ok := financials["current"].(map[string]interface{})
	if !ok {
		log.Printf("DEBUG: no current in positions response: provider_account_id=%s", providerAccountID)
		return nil
	}

	positions, ok := current["positions"].(map[string]interface{})
	if !ok {
		log.Printf("DEBUG: no positions object found: provider_account_id=%s", providerAccountID)
		return nil
	}

	edges, ok := positions["edges"].([]interface{})
	if !ok {
		log.Printf("WARN: no edges in positions: provider_account_id=%s positions=%v",
			providerAccountID, positions)
		return nil
	}

	if len(edges) == 0 {
		log.Printf("INFO: no positions found for account: provider_account_id=%s local_account_id=%s",
			providerAccountID, localAccountID)
		return nil
	}

	log.Printf("INFO: found positions: provider_account_id=%s position_count=%d",
		providerAccountID, len(edges))

	for _, edge := range edges {
		edgeMap, ok := edge.(map[string]interface{})
		if !ok {
			continue
		}

		node, ok := edgeMap["node"].(map[string]interface{})
		if !ok {
			continue
		}

		// Extract quantity (as string, need to parse)
		quantityStr, ok := node["quantity"].(string)
		if !ok {
			log.Printf("DEBUG: quantity not a string: node=%v", node)
			continue
		}

		quantity, err := strconv.ParseFloat(quantityStr, 64)
		if err != nil {
			log.Printf("ERROR: failed to parse quantity: quantity_str=%s error=%v",
				quantityStr, err)
			continue
		}

		// Extract security info
		security, ok := node["security"].(map[string]interface{})
		if !ok {
			log.Printf("DEBUG: no security found: node=%v", node)
			continue
		}

		securityType, _ := security["securityType"].(string)

		stock, ok := security["stock"].(map[string]interface{})
		if !ok {
			log.Printf("DEBUG: no stock found in security: security=%v", security)
			continue
		}

		symbol, _ := stock["symbol"].(string)
		name, _ := stock["name"].(string)

		// Extract average price (cost basis)
		avgPrice, ok := node["averagePrice"].(map[string]interface{})
		if !ok {
			log.Printf("DEBUG: no averagePrice found: node=%v", node)
			continue
		}

		costBasisStr, ok := avgPrice["amount"].(string)
		if !ok {
			log.Printf("DEBUG: cost basis not a string: avgPrice=%v", avgPrice)
			continue
		}

		costBasis, err := strconv.ParseFloat(costBasisStr, 64)
		if err != nil {
			log.Printf("ERROR: failed to parse cost basis: cost_basis_str=%s error=%v",
				costBasisStr, err)
			continue
		}

		// Map security type to holding type
		holdingType := holdings.HoldingTypeStock // Default
		switch securityType {
		case "crypto", "cryptocurrency":
			holdingType = holdings.HoldingTypeCrypto
		case "etf":
			holdingType = holdings.HoldingTypeETF
		case "mutual_fund":
			holdingType = holdings.HoldingTypeMutualFund
		}

		// Create or update holding via holdings service
		holdingResp, err := s.holdingsSvc.Create(ctx, &holdings.CreateHoldingRequest{
			AccountID: localAccountID,
			Type:      holdingType,
			Symbol:    &symbol,
			Quantity:  &quantity,
			CostBasis: &costBasis,
			Notes:     name,
		})

		if err != nil {
			log.Printf("ERROR: failed to create holding: symbol=%s account_id=%s error=%v",
				symbol, localAccountID, err)
			_ = s.updateSyncJobProgress(ctx, jobID, 1, 0, 0, 1)
		} else {
			// Track created vs updated
			if holdingResp.WasUpdate {
				log.Printf("INFO: updated holding: holding_id=%s symbol=%s quantity=%f cost_basis=%f",
					holdingResp.Holding.ID, symbol, quantity, costBasis)
				_ = s.updateSyncJobProgress(ctx, jobID, 1, 0, 1, 0)
			} else {
				log.Printf("INFO: created holding: holding_id=%s symbol=%s quantity=%f cost_basis=%f",
					holdingResp.Holding.ID, symbol, quantity, costBasis)
				_ = s.updateSyncJobProgress(ctx, jobID, 1, 1, 0, 0)
			}
		}
	}

	log.Printf("INFO: finished syncing positions for account: provider_account_id=%s local_account_id=%s position_count=%d",
		providerAccountID, localAccountID, len(edges))

	return nil
}

// syncCreditCardDetails fetches and stores credit card balance
func (s *Service) syncCreditCardDetails(ctx context.Context, client *wealthsimple.Client, providerAccountID, localAccountID string, isAsset bool, jobID string) error {
	variables := map[string]interface{}{
		"id": providerAccountID,
	}

	log.Printf("INFO: fetching credit card details: provider_account_id=%s local_account_id=%s",
		providerAccountID, localAccountID)

	data, err := client.QueryGraphQL(ctx, wealthsimple.QueryFetchCreditCardAccount, variables, "invest")
	if err != nil {
		log.Printf("ERROR: failed to fetch credit card details: provider_account_id=%s error=%v",
			providerAccountID, err)
		return fmt.Errorf("failed to fetch credit card details: %w", err)
	}

	log.Printf("DEBUG: received credit card details: provider_account_id=%s data_keys=%v",
		providerAccountID, getMapKeys(data))

	// Parse credit card account response
	creditCardAccount, ok := data["creditCardAccount"].(map[string]interface{})
	if !ok {
		log.Printf("ERROR: invalid credit card response format: provider_account_id=%s data=%v",
			providerAccountID, data)
		return fmt.Errorf("invalid credit card response format")
	}

	// Extract balance
	balanceData, ok := creditCardAccount["balance"].(map[string]interface{})
	if !ok {
		log.Printf("WARN: no balance found for credit card: provider_account_id=%s", providerAccountID)
		return nil
	}

	// Get outstanding balance (what is owed on the card)
	outstandingStr, ok := balanceData["outstanding"].(string)
	if !ok {
		log.Printf("WARN: outstanding balance not a string: provider_account_id=%s balance=%v",
			providerAccountID, balanceData)
		return nil
	}

	amount, err := strconv.ParseFloat(outstandingStr, 64)
	if err != nil {
		log.Printf("ERROR: failed to parse outstanding balance: provider_account_id=%s outstanding_str=%s error=%v",
			providerAccountID, outstandingStr, err)
		return fmt.Errorf("failed to parse outstanding balance: %w", err)
	}

	// For credit cards, the outstanding balance is debt, so store as negative
	if !isAsset {
		amount = -amount
	}

	// Truncate to just the date (no time component) for proper upsert
	now := time.Now()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())

	// Create or update credit card balance via balance service
	balanceResp, err := s.balanceSvc.Create(ctx, &balance.CreateBalanceRequest{
		AccountID: localAccountID,
		Amount:    amount,
		Date:      today,
		Notes:     "Synced from Wealthsimple Credit Card",
	})

	if err != nil {
		log.Printf("ERROR: failed to create credit card balance: account_id=%s amount=%f error=%v",
			localAccountID, amount, err)
		_ = s.updateSyncJobProgress(ctx, jobID, 1, 0, 0, 1)
		return fmt.Errorf("failed to create credit card balance: %w", err)
	}

	// Track created vs updated
	if balanceResp.WasUpdate {
		log.Printf("INFO: updated credit card balance: account_id=%s amount=%f outstanding=%s",
			localAccountID, amount, outstandingStr)
		_ = s.updateSyncJobProgress(ctx, jobID, 1, 0, 1, 0)
	} else {
		log.Printf("INFO: created credit card balance: account_id=%s amount=%f outstanding=%s",
			localAccountID, amount, outstandingStr)
		_ = s.updateSyncJobProgress(ctx, jobID, 1, 1, 0, 0)
	}

	return nil
}

// isAssetAccount determines if an account type is an asset or liability
func isAssetAccount(accountType string) bool {
	// Liability accounts
	switch accountType {
	case "credit_card", "loan", "mortgage", "line_of_credit":
		return false
	}
	// All other accounts are assets
	return true
}

// mapWealthsimpleAccountType maps Wealthsimple account types to local types
func mapWealthsimpleAccountType(wsType string) string {
	switch wsType {
	case "tfsa":
		return "tfsa"
	case "rrsp":
		return "rrsp"
	case "ca_rrif":
		return "other"
	case "fhsa":
		return "other" // First Home Savings Account
	case "non_registered":
		return "brokerage"
	case "ca_resp":
		return "other"
	case "ca_cash_msb", "ca_cash", "cash":
		return "checking"
	case "ca_credit_card":
		return "credit_card"
	case "crypto":
		return "crypto"
	default:
		return "brokerage"
	}
}

// mapCurrency maps Wealthsimple currency codes to local currency codes
func mapCurrency(wsCurrency string) string {
	switch wsCurrency {
	case "CAD":
		return "CAD"
	case "USD":
		return "USD"
	default:
		return "CAD"
	}
}

// formatAccountTypeName creates a human-readable name from account type
func formatAccountTypeName(accountType string) string {
	switch accountType {
	case "tfsa":
		return "TFSA"
	case "rrsp":
		return "RRSP"
	case "checking":
		return "Checking Account"
	case "investment":
		return "Personal Investment"
	case "brokerage":
		return "Brokerage Account"
	case "credit_card":
		return "Credit Card"
	case "crypto":
		return "Crypto Account"
	default:
		return "Account"
	}
}

// getMapKeys returns the keys of a map as a slice for debugging
func getMapKeys(m map[string]interface{}) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}

// createSyncJob creates a new sync job and marks it as running
func (s *Service) createSyncJob(ctx context.Context, syncedAccountID string, jobType SyncJobType) (string, error) {
	var jobID string
	now := time.Now()

	err := s.db.QueryRowContext(ctx, `
		INSERT INTO sync_jobs (
			synced_account_id, type, status, started_at, created_at
		) VALUES ($1, $2, $3, $4, $5)
		RETURNING id
	`, syncedAccountID, jobType, SyncJobStatusRunning, now, now).Scan(&jobID)

	if err != nil {
		return "", fmt.Errorf("failed to create sync job: %w", err)
	}

	log.Printf("INFO: created sync job: job_id=%s synced_account_id=%s type=%s",
		jobID, syncedAccountID, jobType)

	return jobID, nil
}

// updateSyncJobProgress updates the progress counters for a sync job
func (s *Service) updateSyncJobProgress(ctx context.Context, jobID string, processed, created, updated, failed int) error {
	_, err := s.db.ExecContext(ctx, `
		UPDATE sync_jobs
		SET items_processed = items_processed + $2,
		    items_created = items_created + $3,
		    items_updated = items_updated + $4,
		    items_failed = items_failed + $5
		WHERE id = $1
	`, jobID, processed, created, updated, failed)

	return err
}

// completeSyncJob marks a sync job as completed or failed
func (s *Service) completeSyncJob(ctx context.Context, jobID string, status SyncJobStatus, errorMsg string) error {
	now := time.Now()

	var err error
	if errorMsg != "" {
		_, err = s.db.ExecContext(ctx, `
			UPDATE sync_jobs
			SET status = $2, completed_at = $3, error_message = $4
			WHERE id = $1
		`, jobID, status, now, errorMsg)
	} else {
		_, err = s.db.ExecContext(ctx, `
			UPDATE sync_jobs
			SET status = $2, completed_at = $3
			WHERE id = $1
		`, jobID, status, now)
	}

	if err != nil {
		return fmt.Errorf("failed to complete sync job: %w", err)
	}

	log.Printf("INFO: completed sync job: job_id=%s status=%s error=%s",
		jobID, status, errorMsg)

	return nil
}
