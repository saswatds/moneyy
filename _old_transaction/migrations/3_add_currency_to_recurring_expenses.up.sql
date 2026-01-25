-- Add currency column to recurring_expenses table
ALTER TABLE recurring_expenses
ADD COLUMN currency TEXT NOT NULL DEFAULT 'CAD'
CHECK (currency IN ('CAD', 'USD', 'INR'));

-- Update index for better performance
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_currency ON recurring_expenses(currency);
