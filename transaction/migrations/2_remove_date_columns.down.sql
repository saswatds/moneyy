-- Add back start_date and end_date columns
ALTER TABLE recurring_expenses ADD COLUMN start_date DATE;
ALTER TABLE recurring_expenses ADD COLUMN end_date DATE;
