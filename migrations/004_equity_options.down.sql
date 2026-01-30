-- Drop indexes
DROP INDEX IF EXISTS idx_fmv_history_account;
DROP INDEX IF EXISTS idx_equity_sales_account;
DROP INDEX IF EXISTS idx_equity_exercises_grant;
DROP INDEX IF EXISTS idx_vesting_events_status;
DROP INDEX IF EXISTS idx_vesting_events_grant;
DROP INDEX IF EXISTS idx_equity_grants_type;
DROP INDEX IF EXISTS idx_equity_grants_account;

-- Drop tables in reverse order of dependencies
DROP TABLE IF EXISTS fmv_history;
DROP TABLE IF EXISTS equity_sales;
DROP TABLE IF EXISTS equity_exercises;
DROP TABLE IF EXISTS vesting_events;
DROP TABLE IF EXISTS vesting_schedules;
DROP TABLE IF EXISTS equity_grants;

-- Restore the original accounts table CHECK constraint (without stock_options)
DO $$
BEGIN
    ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_type_check;
EXCEPTION WHEN undefined_object THEN
    -- Constraint doesn't exist, that's fine
    NULL;
END $$;

ALTER TABLE accounts ADD CONSTRAINT accounts_type_check
CHECK (type IN ('checking', 'savings', 'cash', 'brokerage', 'tfsa', 'rrsp', 'crypto',
                'real_estate', 'vehicle', 'collectible', 'credit_card', 'loan',
                'mortgage', 'line_of_credit', 'other'));
