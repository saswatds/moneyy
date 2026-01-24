package wealthsimple

// GraphQL query constants for Wealthsimple API

const (
	// QueryListAccounts lists all accounts for the authenticated user
	QueryListAccounts = `
		query FetchAllAccounts($identityId: ID!) {
			identity(id: $identityId) {
				id
				accounts(filter: {}, first: 100) {
					edges {
						node {
							id
							type
							currency
							nickname
							status
							unifiedAccountType
							createdAt
						}
					}
				}
			}
		}
	`

	// QueryFetchAccountDetails fetches detailed information about a specific account
	QueryFetchAccountDetails = `
		query FetchAccountFinancials($ids: [String!]!) {
			accounts(ids: $ids) {
				id
				custodianAccounts {
					id
					branch
					financials {
						current {
							deposits {
								amount
								currency
							}
							earnings {
								amount
								currency
							}
							netDeposits {
								amount
								currency
							}
							netLiquidationValue {
								amount
								currency
							}
							withdrawals {
								amount
								currency
							}
						}
					}
				}
				financials {
					currentCombined {
						id
						netLiquidationValueV2 {
							amount
							currency
						}
						netDepositsV2 {
							amount
							currency
						}
						totalDepositsV2 {
							amount
							currency
						}
						totalWithdrawalsV2 {
							amount
							currency
						}
					}
				}
			}
		}
	`

	// QueryFetchAccountPositions fetches positions/holdings for specific accounts
	QueryFetchAccountPositions = `
		query FetchIdentityPositions($identityId: ID!, $currency: Currency!, $accountIds: [ID!], $first: Int) {
			identity(id: $identityId) {
				id
				financials(filter: {accounts: $accountIds}) {
					current(currency: $currency) {
						id
						positions(first: $first, aggregated: false) {
							edges {
								node {
									id
									quantity
									averagePrice {
										amount
										currency
									}
									bookValue {
										amount
										currency
									}
									totalValue {
										amount
										currency
									}
									security {
										id
										securityType
										stock {
											name
											symbol
											primaryExchange
										}
									}
								}
							}
							totalCount
						}
					}
				}
			}
		}
	`

	// QueryFetchAccountActivities fetches transaction history for an account
	QueryFetchAccountActivities = `
		query FetchAccountActivities($accountId: String!, $limit: Int, $cursor: String) {
			account(id: $accountId) {
				activities(limit: $limit, after: $cursor) {
					edges {
						node {
							id
							type
							status
							symbol
							quantity
							marketValue {
								amount
								currency
							}
							acceptedAt
							settledAt
							description
						}
						cursor
					}
					pageInfo {
						hasNextPage
						endCursor
					}
				}
			}
		}
	`

	// QueryFetchAccountHistory fetches historical performance data
	QueryFetchAccountHistory = `
		query FetchAccountHistory($accountId: String!, $interval: HistoryInterval!) {
			account(id: $accountId) {
				history(interval: $interval) {
					date
					value {
						amount
						currency
					}
					netDeposits {
						amount
						currency
					}
					gainLoss {
						amount
						currency
					}
				}
			}
		}
	`

	// QueryFetchCreditCardAccount fetches credit card account details including balance
	QueryFetchCreditCardAccount = `
		query FetchCreditCardAccount($id: ID!) {
			creditCardAccount(id: $id) {
				id
				creditLimit
				balance {
					current
					outstanding
					availableCreditLimit
					pending
				}
			}
		}
	`
)
