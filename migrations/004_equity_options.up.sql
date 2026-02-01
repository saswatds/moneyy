-- Equity options system (SQLite)

-- 1. equity_grants - Individual grants (ISO, NSO, RSU, RSA)
CREATE TABLE IF NOT EXISTS equity_grants (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    grant_type TEXT NOT NULL CHECK (grant_type IN ('iso', 'nso', 'rsu', 'rsa')),
    grant_date DATE NOT NULL,
    quantity INTEGER NOT NULL,
    strike_price DECIMAL(15,4),  -- NULL for RSU/RSA
    fmv_at_grant DECIMAL(15,4) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',  -- Currency for this grant
    expiration_date DATE,  -- NULL for RSU/RSA
    company_name TEXT NOT NULL,
    grant_number TEXT,
    notes TEXT,
    created_at DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

-- 2. vesting_schedules - Vesting rules per grant
CREATE TABLE IF NOT EXISTS vesting_schedules (
    id TEXT PRIMARY KEY,
    grant_id TEXT NOT NULL REFERENCES equity_grants(id) ON DELETE CASCADE,
    schedule_type TEXT NOT NULL CHECK (schedule_type IN ('time_based', 'milestone')),
    cliff_months INTEGER,  -- e.g., 12 for 1-year cliff
    total_vesting_months INTEGER,  -- e.g., 48 for 4-year vesting
    vesting_frequency TEXT CHECK (vesting_frequency IN ('monthly', 'quarterly', 'annually')),
    milestone_description TEXT,  -- for milestone-based vesting
    created_at DATETIME NOT NULL DEFAULT (datetime('now')),
    UNIQUE(grant_id)
);

-- 3. vesting_events - Actual vesting occurrences
CREATE TABLE IF NOT EXISTS vesting_events (
    id TEXT PRIMARY KEY,
    grant_id TEXT NOT NULL REFERENCES equity_grants(id) ON DELETE CASCADE,
    vest_date DATE NOT NULL,
    quantity INTEGER NOT NULL,
    fmv_at_vest DECIMAL(15,4) NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'vested', 'forfeited')) DEFAULT 'pending',
    notes TEXT,
    created_at DATETIME NOT NULL DEFAULT (datetime('now')),
    UNIQUE(grant_id, vest_date)
);

-- 4. equity_exercises - Exercise records for options
CREATE TABLE IF NOT EXISTS equity_exercises (
    id TEXT PRIMARY KEY,
    grant_id TEXT NOT NULL REFERENCES equity_grants(id) ON DELETE CASCADE,
    exercise_date DATE NOT NULL,
    quantity INTEGER NOT NULL,
    strike_price DECIMAL(15,4) NOT NULL,
    fmv_at_exercise DECIMAL(15,4) NOT NULL,
    exercise_cost DECIMAL(15,2) NOT NULL,  -- quantity * strike_price
    taxable_benefit DECIMAL(15,2) NOT NULL,  -- quantity * (fmv - strike)
    exercise_method TEXT CHECK (exercise_method IN ('cash', 'cashless', 'same_day_sale')),
    notes TEXT,
    created_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

-- 5. equity_sales - Sale of shares
CREATE TABLE IF NOT EXISTS equity_sales (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    grant_id TEXT REFERENCES equity_grants(id) ON DELETE SET NULL,
    exercise_id TEXT REFERENCES equity_exercises(id) ON DELETE SET NULL,
    sale_date DATE NOT NULL,
    quantity INTEGER NOT NULL,
    sale_price DECIMAL(15,4) NOT NULL,
    total_proceeds DECIMAL(15,2) NOT NULL,
    cost_basis DECIMAL(15,2) NOT NULL,
    capital_gain DECIMAL(15,2) NOT NULL,
    holding_period_days INTEGER,
    is_qualified INTEGER,  -- for Canadian stock option deduction eligibility
    notes TEXT,
    created_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

-- 6. fmv_history - Manual FMV entries (per currency)
CREATE TABLE IF NOT EXISTS fmv_history (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    currency TEXT NOT NULL DEFAULT 'USD',  -- FMV tracked per currency
    effective_date DATE NOT NULL,
    fmv_per_share DECIMAL(15,4) NOT NULL,
    notes TEXT,
    created_at DATETIME NOT NULL DEFAULT (datetime('now')),
    UNIQUE(account_id, currency, effective_date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_equity_grants_account ON equity_grants(account_id);
CREATE INDEX IF NOT EXISTS idx_equity_grants_type ON equity_grants(grant_type);
CREATE INDEX IF NOT EXISTS idx_vesting_events_grant ON vesting_events(grant_id);
CREATE INDEX IF NOT EXISTS idx_vesting_events_status ON vesting_events(status);
CREATE INDEX IF NOT EXISTS idx_equity_exercises_grant ON equity_exercises(grant_id);
CREATE INDEX IF NOT EXISTS idx_equity_sales_account ON equity_sales(account_id);
CREATE INDEX IF NOT EXISTS idx_fmv_history_account ON fmv_history(account_id);

-- SQLite doesn't support ALTER TABLE ... DROP CONSTRAINT or DO blocks
-- We need to recreate the accounts table with the new constraint
-- However, since SQLite migrations run sequentially and the original table
-- was created in 001_initial_schema.up.sql, we just need to ensure the
-- accounts table accepts 'stock_options' as a valid type.
--
-- In SQLite, we can't modify CHECK constraints without recreating the table.
-- Instead, we'll rely on application-level validation for the new type.
-- The original CHECK constraint will still work for existing types.
--
-- For a proper migration, we would need to:
-- 1. Create a new table with the updated constraint
-- 2. Copy all data from old table
-- 3. Drop old table
-- 4. Rename new table
--
-- But since this is a fresh SQLite migration (converting from PostgreSQL),
-- we'll update the original 001_initial_schema.up.sql to include 'stock_options'
