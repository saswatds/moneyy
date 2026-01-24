package sync

import (
	"context"
	"fmt"
	"strconv"
	"time"

	accountsvc "encore.app/account"
	balancesvc "encore.app/balance"
	holdingsvc "encore.app/holdings"
	"encore.app/sync/internal/wealthsimple"
	"encore.dev/rlog"
)

// performInitialSync performs the initial sync of accounts from Wealthsimple
func performInitialSync(ctx context.Context, userID, connectionID string) error {
	// Update connection status to syncing
	_, err := db.Exec(ctx, `
		UPDATE sync_credentials
		SET status = $1, updated_at = $2
		WHERE id = $3
	`, StatusSyncing, time.Now(), connectionID)
	if err != nil {
		return fmt.Errorf("failed to update connection status: %w", err)
	}

	// Get authenticated client
	client, err := getDecryptedCredentials(ctx, userID)
	if err != nil {
		return fmt.Errorf("failed to get credentials: %w", err)
	}

	// Get identity ID from credentials
	var identityID string
	err = db.QueryRow(ctx, `
		SELECT identity_canonical_id
		FROM sync_credentials
		WHERE user_id = $1
	`, userID).Scan(&identityID)

	if err != nil || identityID == "" {
		return fmt.Errorf("identity ID not found in credentials: %w", err)
	}

	// Fetch accounts from Wealthsimple
	rlog.Info("fetching accounts from wealthsimple",
		"connection_id", connectionID,
		"identity_id", identityID)
	variables := map[string]interface{}{
		"identityId": identityID,
	}
	data, err := client.QueryGraphQL(ctx, wealthsimple.QueryListAccounts, variables, "trade")
	if err != nil {
		rlog.Error("failed to fetch accounts", "error", err)
		return fmt.Errorf("failed to fetch accounts: %w", err)
	}
	rlog.Debug("received account data", "data", data)

	// Parse accounts from identity.accounts.edges structure
	identity, ok := data["identity"].(map[string]interface{})
	if !ok {
		return fmt.Errorf("invalid response format: no identity field")
	}

	accountsData, ok := identity["accounts"].(map[string]interface{})
	if !ok {
		return fmt.Errorf("invalid response format: no accounts field")
	}

	edges, ok := accountsData["edges"].([]interface{})
	if !ok {
		return fmt.Errorf("invalid response format: no edges field")
	}

	rlog.Info("processing account edges", "count", len(edges))

	accountCount := 0
	for _, edge := range edges {
		edgeMap, ok := edge.(map[string]interface{})
		if !ok {
			rlog.Debug("skipping non-map edge", "edge", edge)
			continue
		}

		account, ok := edgeMap["node"].(map[string]interface{})
		if !ok {
			rlog.Debug("skipping edge with no node", "edge", edgeMap)
			continue
		}

		// Extract account data
		providerAccountID, _ := account["id"].(string)
		nickname, _ := account["nickname"].(string)
		accountType, _ := account["type"].(string)
		currency, _ := account["currency"].(string)
		status, _ := account["status"].(string)

		if status != "open" {
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
		err = db.QueryRow(ctx, `
			SELECT local_account_id
			FROM synced_accounts
			WHERE credential_id = $1 AND provider_account_id = $2
		`, connectionID, providerAccountID).Scan(&localAccountID)

		if err == nil {
			// Account already exists, skip creation
			rlog.Debug("account already synced, skipping creation",
				"provider_account_id", providerAccountID,
				"local_account_id", localAccountID)
		} else {
			// Account doesn't exist, create it
			// Determine if this is an asset or liability account
			isAsset := isAssetAccount(localAccountType)

			createdAccount, err := accountsvc.Create(ctx, &accountsvc.CreateAccountRequest{
				Name:         nickname,
				Type:         accountsvc.AccountType(localAccountType),
				Currency:     accountsvc.Currency(mapCurrency(currency)),
				Institution:  "Wealthsimple",
				IsAsset:      isAsset,
				IsSynced:     true,
				ConnectionID: connectionID,
			})

			if err != nil {
				rlog.Error("failed to create local account",
					"provider_account_id", providerAccountID,
					"error", err)
				continue
			}

			localAccountID = createdAccount.ID

			// Create synced account record
			_, err = db.Exec(ctx, `
				INSERT INTO synced_accounts (
					credential_id, local_account_id, provider_account_id,
					created_at, updated_at
				) VALUES ($1, $2, $3, $4, $5)
			`, connectionID, localAccountID, providerAccountID, time.Now(), time.Now())

			if err != nil {
				rlog.Error("failed to create synced account",
					"provider_account_id", providerAccountID,
					"error", err)
				continue
			}

			rlog.Info("created new synced account",
				"provider_account_id", providerAccountID,
				"local_account_id", localAccountID)
		}

		// Fetch account details (balances, positions)
		isAssetAcc := isAssetAccount(localAccountType)
		isCreditCard := localAccountType == "credit_card"
		if err := syncAccountDetails(ctx, client, providerAccountID, localAccountID, identityID, isAssetAcc, isCreditCard); err != nil {
			rlog.Error("failed to sync account details",
				"provider_account_id", providerAccountID,
				"error", err)
		}

		accountCount++
	}

	// Update connection with success
	_, err = db.Exec(ctx, `
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
func syncAccountDetails(ctx context.Context, client *wealthsimple.Client, providerAccountID, localAccountID, identityID string, isAsset, isCreditCard bool) error {
	// Credit cards use a different GraphQL endpoint
	if isCreditCard {
		return syncCreditCardDetails(ctx, client, providerAccountID, localAccountID, isAsset)
	}

	variables := map[string]interface{}{
		"ids": []string{providerAccountID},
	}

	rlog.Info("fetching account details",
		"provider_account_id", providerAccountID,
		"local_account_id", localAccountID)

	data, err := client.QueryGraphQL(ctx, wealthsimple.QueryFetchAccountDetails, variables, "trade")
	if err != nil {
		rlog.Error("failed to fetch account details",
			"provider_account_id", providerAccountID,
			"error", err)
		return fmt.Errorf("failed to fetch account details: %w", err)
	}

	rlog.Debug("received account details response",
		"provider_account_id", providerAccountID,
		"data_keys", getMapKeys(data))

	accounts, ok := data["accounts"].([]interface{})
	if !ok || len(accounts) == 0 {
		rlog.Error("invalid response format - no accounts field or empty",
			"provider_account_id", providerAccountID,
			"data", data)
		return fmt.Errorf("invalid response format")
	}

	account, ok := accounts[0].(map[string]interface{})
	if !ok {
		rlog.Error("invalid account format",
			"provider_account_id", providerAccountID)
		return fmt.Errorf("invalid account format")
	}

	rlog.Debug("account data structure",
		"provider_account_id", providerAccountID,
		"account_keys", getMapKeys(account))

	// Extract balance from financials
	var amount float64
	var foundBalance bool

	if financials, ok := account["financials"].(map[string]interface{}); ok {
		rlog.Debug("found financials field",
			"provider_account_id", providerAccountID,
			"financials_keys", getMapKeys(financials))

		// For credit cards and other accounts, try currentBalance first
		if !isAsset {
			// Try currentBalance for liability accounts
			if currentBalance, ok := financials["currentBalance"].(map[string]interface{}); ok {
				rlog.Debug("found currentBalance for liability account",
					"provider_account_id", providerAccountID,
					"currentBalance_keys", getMapKeys(currentBalance))

				if amountObj, ok := currentBalance["amount"].(string); ok {
					parsedAmount, err := strconv.ParseFloat(amountObj, 64)
					if err == nil {
						amount = parsedAmount
						foundBalance = true
						rlog.Info("found balance from currentBalance",
							"provider_account_id", providerAccountID,
							"amount", amount)
					}
				}
			}
		}

		// If not found yet, try netLiquidationValue (for investment accounts)
		if !foundBalance {
			if currentCombined, ok := financials["currentCombined"].(map[string]interface{}); ok {
				rlog.Debug("found currentCombined",
					"provider_account_id", providerAccountID,
					"currentCombined_keys", getMapKeys(currentCombined))

				if netLiquidationValue, ok := currentCombined["netLiquidationValueV2"].(map[string]interface{}); ok {
					// Amount comes as a string, need to parse it
					amountStr, ok := netLiquidationValue["amount"].(string)
					if !ok {
						rlog.Debug("amount is not a string, trying float64",
							"provider_account_id", providerAccountID)
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
							rlog.Info("found balance from netLiquidationValue",
								"provider_account_id", providerAccountID,
								"amount", amount)
						}
					}
				} else {
					rlog.Debug("no netLiquidationValueV2 found",
						"provider_account_id", providerAccountID)
				}
			} else {
				rlog.Debug("no currentCombined found",
					"provider_account_id", providerAccountID)
			}
		}

		// If still not found, log all available keys for debugging
		if !foundBalance {
			rlog.Warn("could not find balance in any known location",
				"provider_account_id", providerAccountID,
				"financials_keys", getMapKeys(financials),
				"is_asset", isAsset)
		}
	} else {
		rlog.Debug("no financials field found",
			"provider_account_id", providerAccountID)
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

		rlog.Info("creating balance entry",
			"account_id", localAccountID,
			"amount", amount,
			"date", today,
			"is_asset", isAsset)

		// Create balance via balance service API
		_, err = balancesvc.Create(ctx, &balancesvc.CreateBalanceRequest{
			AccountID: localAccountID,
			Amount:    amount,
			Date:      today,
			Notes:     "Synced from Wealthsimple",
		})

		if err != nil {
			rlog.Error("failed to create balance",
				"account_id", localAccountID,
				"amount", amount,
				"error", err)
		} else {
			rlog.Info("successfully created balance",
				"account_id", localAccountID,
				"amount", amount)
		}
	}

	// Fetch positions using identity-based query
	rlog.Info("fetching account positions",
		"provider_account_id", providerAccountID,
		"local_account_id", localAccountID,
		"identity_id", identityID)

	positionsVariables := map[string]interface{}{
		"identityId": identityID,
		"currency":   "CAD",
		"accountIds": []string{providerAccountID},
		"first":      500,
	}

	positionsData, err := client.QueryGraphQL(ctx, wealthsimple.QueryFetchAccountPositions, positionsVariables, "trade")
	if err != nil {
		rlog.Error("failed to fetch positions",
			"provider_account_id", providerAccountID,
			"error", err)
		// Don't return error, balances already synced
		return nil
	}

	// Parse positions response: identity.financials.current.positions.edges
	identity, ok := positionsData["identity"].(map[string]interface{})
	if !ok {
		rlog.Debug("no identity in positions response",
			"provider_account_id", providerAccountID)
		return nil
	}

	financials, ok := identity["financials"].(map[string]interface{})
	if !ok {
		rlog.Debug("no financials in positions response",
			"provider_account_id", providerAccountID)
		return nil
	}

	current, ok := financials["current"].(map[string]interface{})
	if !ok {
		rlog.Debug("no current in positions response",
			"provider_account_id", providerAccountID)
		return nil
	}

	positions, ok := current["positions"].(map[string]interface{})
	if !ok {
		rlog.Debug("no positions object found",
			"provider_account_id", providerAccountID)
		return nil
	}

	edges, ok := positions["edges"].([]interface{})
	if !ok {
		rlog.Debug("no edges in positions",
			"provider_account_id", providerAccountID)
		return nil
	}

	rlog.Info("found positions",
		"provider_account_id", providerAccountID,
		"position_count", len(edges))

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
			rlog.Debug("quantity not a string", "node", node)
			continue
		}

		quantity, err := strconv.ParseFloat(quantityStr, 64)
		if err != nil {
			rlog.Error("failed to parse quantity",
				"quantity_str", quantityStr,
				"error", err)
			continue
		}

		// Extract security info
		security, ok := node["security"].(map[string]interface{})
		if !ok {
			rlog.Debug("no security found", "node", node)
			continue
		}

		securityType, _ := security["securityType"].(string)

		stock, ok := security["stock"].(map[string]interface{})
		if !ok {
			rlog.Debug("no stock found in security", "security", security)
			continue
		}

		symbol, _ := stock["symbol"].(string)
		name, _ := stock["name"].(string)

		// Extract average price (cost basis)
		avgPrice, ok := node["averagePrice"].(map[string]interface{})
		if !ok {
			rlog.Debug("no averagePrice found", "node", node)
			continue
		}

		costBasisStr, ok := avgPrice["amount"].(string)
		if !ok {
			rlog.Debug("cost basis not a string", "avgPrice", avgPrice)
			continue
		}

		costBasis, err := strconv.ParseFloat(costBasisStr, 64)
		if err != nil {
			rlog.Error("failed to parse cost basis",
				"cost_basis_str", costBasisStr,
				"error", err)
			continue
		}

		// Map security type to holding type
		holdingType := holdingsvc.HoldingTypeStock // Default
		switch securityType {
		case "crypto", "cryptocurrency":
			holdingType = holdingsvc.HoldingTypeCrypto
		case "etf":
			holdingType = holdingsvc.HoldingTypeETF
		case "mutual_fund":
			holdingType = holdingsvc.HoldingTypeMutualFund
		}

		rlog.Info("creating holding entry",
			"account_id", localAccountID,
			"symbol", symbol,
			"quantity", quantity,
			"cost_basis", costBasis,
			"type", holdingType)

		// Create holding via holdings service API
		_, err = holdingsvc.Create(ctx, &holdingsvc.CreateHoldingRequest{
			AccountID: localAccountID,
			Type:      holdingType,
			Symbol:    &symbol,
			Quantity:  &quantity,
			CostBasis: &costBasis,
			Notes:     name,
		})

		if err != nil {
			rlog.Error("failed to create holding",
				"symbol", symbol,
				"account_id", localAccountID,
				"error", err)
		} else {
			rlog.Info("successfully created holding",
				"symbol", symbol,
				"quantity", quantity,
				"cost_basis", costBasis)
		}
	}

	return nil
}

// syncCreditCardDetails fetches and stores credit card balance
func syncCreditCardDetails(ctx context.Context, client *wealthsimple.Client, providerAccountID, localAccountID string, isAsset bool) error {
	variables := map[string]interface{}{
		"id": providerAccountID,
	}

	rlog.Info("fetching credit card details",
		"provider_account_id", providerAccountID,
		"local_account_id", localAccountID)

	data, err := client.QueryGraphQL(ctx, wealthsimple.QueryFetchCreditCardAccount, variables, "invest")
	if err != nil {
		rlog.Error("failed to fetch credit card details",
			"provider_account_id", providerAccountID,
			"error", err)
		return fmt.Errorf("failed to fetch credit card details: %w", err)
	}

	rlog.Debug("received credit card details",
		"provider_account_id", providerAccountID,
		"data_keys", getMapKeys(data))

	// Parse credit card account response
	creditCardAccount, ok := data["creditCardAccount"].(map[string]interface{})
	if !ok {
		rlog.Error("invalid credit card response format",
			"provider_account_id", providerAccountID,
			"data", data)
		return fmt.Errorf("invalid credit card response format")
	}

	// Extract balance
	balance, ok := creditCardAccount["balance"].(map[string]interface{})
	if !ok {
		rlog.Warn("no balance found for credit card",
			"provider_account_id", providerAccountID)
		return nil
	}

	// Get outstanding balance (what is owed on the card)
	outstandingStr, ok := balance["outstanding"].(string)
	if !ok {
		rlog.Warn("outstanding balance not a string",
			"provider_account_id", providerAccountID,
			"balance", balance)
		return nil
	}

	amount, err := strconv.ParseFloat(outstandingStr, 64)
	if err != nil {
		rlog.Error("failed to parse outstanding balance",
			"provider_account_id", providerAccountID,
			"outstanding_str", outstandingStr,
			"error", err)
		return fmt.Errorf("failed to parse outstanding balance: %w", err)
	}

	// For credit cards, the outstanding balance is debt, so store as negative
	if !isAsset {
		amount = -amount
	}

	// Truncate to just the date (no time component) for proper upsert
	now := time.Now()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())

	rlog.Info("creating credit card balance entry",
		"account_id", localAccountID,
		"amount", amount,
		"outstanding", outstandingStr,
		"date", today,
		"is_asset", isAsset)

	// Create balance via balance service API
	_, err = balancesvc.Create(ctx, &balancesvc.CreateBalanceRequest{
		AccountID: localAccountID,
		Amount:    amount,
		Date:      today,
		Notes:     "Synced from Wealthsimple Credit Card",
	})

	if err != nil {
		rlog.Error("failed to create credit card balance",
			"account_id", localAccountID,
			"amount", amount,
			"error", err)
		return fmt.Errorf("failed to create credit card balance: %w", err)
	}

	rlog.Info("successfully created credit card balance",
		"account_id", localAccountID,
		"amount", amount,
		"outstanding", outstandingStr)

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
