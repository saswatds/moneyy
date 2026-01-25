-- Remove currency column and index
DROP INDEX IF EXISTS idx_recurring_expenses_currency;
ALTER TABLE recurring_expenses DROP COLUMN IF EXISTS currency;
