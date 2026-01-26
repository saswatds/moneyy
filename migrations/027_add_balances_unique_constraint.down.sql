-- Remove unique constraint from balances table
ALTER TABLE balances DROP CONSTRAINT IF EXISTS balances_account_date_unique;
