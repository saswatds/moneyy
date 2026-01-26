CREATE TABLE IF NOT EXISTS loan_details (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

    -- Loan Details
    original_amount DECIMAL(15, 2) NOT NULL,
    interest_rate DECIMAL(5, 4) NOT NULL, -- stored as decimal (e.g., 0.0525 for 5.25%)
    rate_type TEXT NOT NULL CHECK (rate_type IN ('fixed', 'variable')),

    -- Term Details
    start_date DATE NOT NULL,
    term_months INTEGER NOT NULL, -- total term in months

    -- Payment Details
    payment_amount DECIMAL(15, 2) NOT NULL,
    payment_frequency TEXT NOT NULL CHECK (payment_frequency IN ('weekly', 'bi-weekly', 'semi-monthly', 'monthly')),
    payment_day INTEGER, -- day of month for monthly, day of week for weekly

    -- Loan Metadata
    loan_type TEXT, -- personal, auto, student, business, etc.
    lender TEXT,
    loan_number TEXT,
    purpose TEXT,
    maturity_date DATE NOT NULL,
    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(account_id)
);

-- Loan payments table for tracking actual payments
CREATE TABLE IF NOT EXISTS loan_payments (
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

CREATE INDEX IF NOT EXISTS idx_loan_details_account ON loan_details(account_id);
CREATE INDEX IF NOT EXISTS idx_loan_payments_account ON loan_payments(account_id);
CREATE INDEX IF NOT EXISTS idx_loan_payments_date ON loan_payments(account_id, payment_date);
