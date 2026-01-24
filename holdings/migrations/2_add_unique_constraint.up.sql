-- Add unique constraint on account_id + symbol to prevent duplicate holdings for same security
ALTER TABLE holdings ADD CONSTRAINT holdings_account_symbol_unique UNIQUE (account_id, symbol);
