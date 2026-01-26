-- Create balances table
CREATE TABLE balances (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    account_id TEXT NOT NULL,
    amount DECIMAL(20, 2) NOT NULL,
    date TIMESTAMP WITH TIME ZONE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create index on account_id for faster balance history queries
CREATE INDEX idx_balances_account_id ON balances(account_id);

-- Create index on date for time-based queries
CREATE INDEX idx_balances_date ON balances(date DESC);

-- Create composite index for account + date queries
CREATE INDEX idx_balances_account_date ON balances(account_id, date DESC);
