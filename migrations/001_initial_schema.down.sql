-- Rollback initial schema (SQLite)

DROP TABLE IF EXISTS recurring_expenses;
DROP TABLE IF EXISTS projection_scenarios;
DROP TABLE IF EXISTS market_data;
DROP TABLE IF EXISTS holding_transactions;
DROP TABLE IF EXISTS holdings;
DROP TABLE IF EXISTS exchange_rates;
DROP TABLE IF EXISTS asset_depreciation_entries;
DROP TABLE IF EXISTS asset_details;
DROP TABLE IF EXISTS loan_payments;
DROP TABLE IF EXISTS loan_details;
DROP TABLE IF EXISTS mortgage_payments;
DROP TABLE IF EXISTS mortgage_details;
DROP TABLE IF EXISTS balances;
DROP TABLE IF EXISTS accounts;
