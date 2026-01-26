CREATE TABLE IF NOT EXISTS recurring_expenses (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,

    -- Expense Details
    name TEXT NOT NULL,
    description TEXT,
    amount DECIMAL(15, 2) NOT NULL,
    category TEXT NOT NULL,

    -- Account (cross-service reference, no FK constraint)
    account_id TEXT,

    -- Recurrence Details
    frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'bi-weekly', 'monthly', 'quarterly', 'annually')),
    day_of_month INTEGER, -- For monthly (1-31)
    day_of_week INTEGER, -- For weekly (0=Sunday, 6=Saturday)

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for user queries
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_user ON recurring_expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_active ON recurring_expenses(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_category ON recurring_expenses(user_id, category);
