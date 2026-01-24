-- Create projections table
CREATE TABLE projections (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    account_id TEXT NOT NULL,
    annual_return_rate DECIMAL(5, 2) NOT NULL,
    monthly_contribution DECIMAL(20, 2) NOT NULL DEFAULT 0,
    projection_type TEXT NOT NULL CHECK (projection_type IN ('historical', 'manual', 'contribution')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create index on account_id for faster queries
CREATE INDEX idx_projections_account_id ON projections(account_id);

-- Create index on is_active for active projections
CREATE INDEX idx_projections_is_active ON projections(is_active);
