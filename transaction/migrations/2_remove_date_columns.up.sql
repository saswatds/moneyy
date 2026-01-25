-- Remove start_date and end_date columns from recurring_expenses
ALTER TABLE recurring_expenses DROP COLUMN IF EXISTS start_date;
ALTER TABLE recurring_expenses DROP COLUMN IF EXISTS end_date;
