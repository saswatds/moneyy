-- Create accounts table
CREATE TABLE accounts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN (
        'checking', 'savings', 'cash',
        'brokerage', 'tfsa', 'rrsp', 'stocks', 'crypto',
        'real_estate', 'vehicle', 'collectible', 'other',
        'credit_card', 'loan', 'mortgage', 'line_of_credit'
    )),
    currency TEXT NOT NULL CHECK (currency IN ('CAD', 'USD', 'INR')),
    institution TEXT,
    is_asset BOOLEAN NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create index on user_id for faster queries
CREATE INDEX idx_accounts_user_id ON accounts(user_id);

-- Create index on type for filtering
CREATE INDEX idx_accounts_type ON accounts(type);

-- Create index on is_active for active accounts queries
CREATE INDEX idx_accounts_is_active ON accounts(is_active);
