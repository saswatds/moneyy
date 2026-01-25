-- Add unique constraint on account_id + date to prevent duplicate balances for same day
ALTER TABLE balances ADD CONSTRAINT balances_account_date_unique UNIQUE (account_id, date);
