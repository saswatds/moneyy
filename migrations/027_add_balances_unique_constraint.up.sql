-- Add unique constraint to balances table to prevent duplicate entries for same account/date
-- First, remove any duplicate entries (keep the most recent one)
DELETE FROM balances a USING (
    SELECT account_id, date, MAX(created_at) as max_created
    FROM balances
    GROUP BY account_id, date
    HAVING COUNT(*) > 1
) b
WHERE a.account_id = b.account_id
  AND a.date = b.date
  AND a.created_at < b.max_created;

-- Add unique constraint (skip if already exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'balances_account_date_unique'
    ) THEN
        ALTER TABLE balances ADD CONSTRAINT balances_account_date_unique UNIQUE (account_id, date);
    END IF;
END $$;
