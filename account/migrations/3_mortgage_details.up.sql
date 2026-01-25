CREATE TABLE IF NOT EXISTS mortgage_details (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

    -- Loan Details
    original_amount DECIMAL(15, 2) NOT NULL,
    interest_rate DECIMAL(5, 4) NOT NULL, -- stored as decimal (e.g., 0.0525 for 5.25%)
    rate_type TEXT NOT NULL CHECK (rate_type IN ('fixed', 'variable')),

    -- Term Details
    start_date DATE NOT NULL,
    term_months INTEGER NOT NULL, -- total term in months (e.g., 300 for 25 years)
    amortization_months INTEGER NOT NULL, -- amortization period

    -- Payment Details
    payment_amount DECIMAL(15, 2) NOT NULL,
    payment_frequency TEXT NOT NULL CHECK (payment_frequency IN ('weekly', 'bi-weekly', 'semi-monthly', 'monthly')),
    payment_day INTEGER, -- day of month for monthly, day of week for weekly

    -- Property Details
    property_address TEXT,
    property_city TEXT,
    property_province TEXT,
    property_postal_code TEXT,
    property_value DECIMAL(15, 2),

    -- Renewal Details
    renewal_date DATE,
    maturity_date DATE NOT NULL,

    -- Metadata
    lender TEXT,
    mortgage_number TEXT,
    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(account_id)
);

-- Mortgage payments table for tracking actual payments
CREATE TABLE IF NOT EXISTS mortgage_payments (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

    payment_date DATE NOT NULL,
    payment_amount DECIMAL(15, 2) NOT NULL,
    principal_amount DECIMAL(15, 2) NOT NULL,
    interest_amount DECIMAL(15, 2) NOT NULL,
    extra_payment DECIMAL(15, 2) DEFAULT 0, -- prepayments

    balance_after DECIMAL(15, 2) NOT NULL,

    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(account_id, payment_date)
);

CREATE INDEX IF NOT EXISTS idx_mortgage_details_account ON mortgage_details(account_id);
CREATE INDEX IF NOT EXISTS idx_mortgage_payments_account ON mortgage_payments(account_id);
CREATE INDEX IF NOT EXISTS idx_mortgage_payments_date ON mortgage_payments(account_id, payment_date);
