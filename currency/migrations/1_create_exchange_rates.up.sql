-- Create exchange_rates table
CREATE TABLE exchange_rates (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    from_currency TEXT NOT NULL CHECK (from_currency IN ('CAD', 'USD', 'INR')),
    to_currency TEXT NOT NULL CHECK (to_currency IN ('CAD', 'USD', 'INR')),
    rate DECIMAL(20, 8) NOT NULL,
    date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(from_currency, to_currency, date)
);

-- Create index on currencies and date for conversion queries
CREATE INDEX idx_exchange_rates_currencies_date ON exchange_rates(from_currency, to_currency, date DESC);
