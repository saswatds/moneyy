-- Create holdings table
CREATE TABLE holdings (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    account_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN (
        'cash', 'stock', 'etf', 'mutual_fund', 'bond', 'crypto', 'option', 'other'
    )),

    -- For securities (stocks, ETFs, crypto, etc.)
    symbol TEXT,
    quantity DECIMAL(20, 8),
    cost_basis DECIMAL(20, 2),

    -- For cash holdings
    currency TEXT CHECK (currency IN ('CAD', 'USD', 'INR')),
    amount DECIMAL(20, 2),

    -- Metadata
    purchase_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT holdings_security_check CHECK (
        (type = 'cash' AND currency IS NOT NULL AND amount IS NOT NULL) OR
        (type != 'cash' AND symbol IS NOT NULL AND quantity IS NOT NULL)
    )
);

-- Create indexes for faster queries
CREATE INDEX idx_holdings_account_id ON holdings(account_id);
CREATE INDEX idx_holdings_type ON holdings(type);
CREATE INDEX idx_holdings_symbol ON holdings(symbol);

-- Create holding_transactions table
CREATE TABLE holding_transactions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    holding_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN (
        'buy', 'sell', 'dividend', 'split', 'transfer', 'deposit', 'withdrawal'
    )),
    quantity DECIMAL(20, 8),
    price DECIMAL(20, 2),
    total_amount DECIMAL(20, 2),
    transaction_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for transactions
CREATE INDEX idx_holding_transactions_holding_id ON holding_transactions(holding_id);
CREATE INDEX idx_holding_transactions_date ON holding_transactions(transaction_date DESC);
CREATE INDEX idx_holding_transactions_type ON holding_transactions(type);

-- Create market_data table for real-time prices
CREATE TABLE market_data (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    symbol TEXT NOT NULL UNIQUE,
    price DECIMAL(20, 2) NOT NULL,
    currency TEXT NOT NULL CHECK (currency IN ('CAD', 'USD', 'INR')),
    last_updated TIMESTAMP WITH TIME ZONE NOT NULL,
    source TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create index on symbol for fast lookups
CREATE INDEX idx_market_data_symbol ON market_data(symbol);
CREATE INDEX idx_market_data_last_updated ON market_data(last_updated DESC);
