-- Core financial management tables

-- Accounts table
CREATE TABLE accounts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN (
        'checking', 'savings', 'cash', 'brokerage', 'tfsa', 'rrsp', 'crypto',
        'real_estate', 'vehicle', 'collectible', 'other',
        'credit_card', 'loan', 'mortgage', 'line_of_credit'
    )),
    currency TEXT NOT NULL CHECK (currency IN ('CAD', 'USD', 'INR')),
    institution TEXT,
    is_asset BOOLEAN NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_synced BOOLEAN NOT NULL DEFAULT false,
    connection_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_accounts_user_id ON accounts(user_id);
CREATE INDEX idx_accounts_type ON accounts(type);
CREATE INDEX idx_accounts_is_active ON accounts(is_active);
CREATE INDEX idx_accounts_is_synced ON accounts(is_synced);
CREATE INDEX idx_accounts_connection_id ON accounts(connection_id);

-- Balances table
CREATE TABLE balances (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    account_id TEXT NOT NULL,
    amount DECIMAL(20,2) NOT NULL,
    date TIMESTAMP WITH TIME ZONE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT balances_account_date_unique UNIQUE(account_id, date)
);

CREATE INDEX idx_balances_account_id ON balances(account_id);
CREATE INDEX idx_balances_date ON balances(date);
CREATE INDEX idx_balances_account_date ON balances(account_id, date);

-- Mortgage details table
CREATE TABLE mortgage_details (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    account_id TEXT NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
    original_amount DECIMAL(15,2) NOT NULL,
    interest_rate DECIMAL(5,4) NOT NULL,
    rate_type TEXT NOT NULL CHECK (rate_type IN ('fixed', 'variable')),
    start_date DATE NOT NULL,
    term_months INTEGER NOT NULL,
    amortization_months INTEGER NOT NULL,
    payment_amount DECIMAL(15,2) NOT NULL,
    payment_frequency TEXT NOT NULL CHECK (payment_frequency IN ('weekly', 'bi-weekly', 'semi-monthly', 'monthly')),
    payment_day INTEGER,
    property_address TEXT,
    property_city TEXT,
    property_province TEXT,
    property_postal_code TEXT,
    property_value DECIMAL(15,2),
    renewal_date DATE,
    maturity_date DATE NOT NULL,
    lender TEXT,
    mortgage_number TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mortgage_details_account ON mortgage_details(account_id);

-- Mortgage payments table
CREATE TABLE mortgage_payments (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    payment_date DATE NOT NULL,
    payment_amount DECIMAL(15,2) NOT NULL,
    principal_amount DECIMAL(15,2) NOT NULL,
    interest_amount DECIMAL(15,2) NOT NULL,
    extra_payment DECIMAL(15,2) DEFAULT 0,
    balance_after DECIMAL(15,2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(account_id, payment_date)
);

CREATE INDEX idx_mortgage_payments_account ON mortgage_payments(account_id);
CREATE INDEX idx_mortgage_payments_date ON mortgage_payments(payment_date);

-- Loan details table
CREATE TABLE loan_details (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    account_id TEXT NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
    original_amount DECIMAL(15,2) NOT NULL,
    interest_rate DECIMAL(5,4) NOT NULL,
    rate_type TEXT NOT NULL CHECK (rate_type IN ('fixed', 'variable')),
    start_date DATE NOT NULL,
    term_months INTEGER NOT NULL,
    payment_amount DECIMAL(15,2) NOT NULL,
    payment_frequency TEXT NOT NULL CHECK (payment_frequency IN ('weekly', 'bi-weekly', 'semi-monthly', 'monthly')),
    payment_day INTEGER,
    loan_type TEXT,
    lender TEXT,
    loan_number TEXT,
    purpose TEXT,
    maturity_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_loan_details_account ON loan_details(account_id);

-- Loan payments table
CREATE TABLE loan_payments (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    payment_date DATE NOT NULL,
    payment_amount DECIMAL(15,2) NOT NULL,
    principal_amount DECIMAL(15,2) NOT NULL,
    interest_amount DECIMAL(15,2) NOT NULL,
    extra_payment DECIMAL(15,2) DEFAULT 0,
    balance_after DECIMAL(15,2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(account_id, payment_date)
);

CREATE INDEX idx_loan_payments_account ON loan_payments(account_id);
CREATE INDEX idx_loan_payments_date ON loan_payments(payment_date);

-- Asset details table
CREATE TABLE asset_details (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    account_id TEXT NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
    asset_type TEXT NOT NULL CHECK (asset_type IN ('real_estate', 'vehicle', 'collectible', 'equipment')),
    purchase_price DECIMAL(15,2) NOT NULL,
    purchase_date DATE NOT NULL,
    depreciation_method TEXT NOT NULL CHECK (depreciation_method IN ('straight_line', 'declining_balance', 'manual')),
    useful_life_years INTEGER,
    salvage_value DECIMAL(15,2) DEFAULT 0,
    depreciation_rate DECIMAL(5,4),
    type_specific_data JSONB,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_asset_details_account ON asset_details(account_id);
CREATE INDEX idx_asset_details_type ON asset_details(asset_type);

-- Asset depreciation entries table
CREATE TABLE asset_depreciation_entries (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    entry_date DATE NOT NULL,
    current_value DECIMAL(15,2) NOT NULL,
    accumulated_depreciation DECIMAL(15,2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(account_id, entry_date)
);

CREATE INDEX idx_asset_depreciation_account ON asset_depreciation_entries(account_id);
CREATE INDEX idx_asset_depreciation_date ON asset_depreciation_entries(entry_date);

-- Exchange rates table
CREATE TABLE exchange_rates (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    from_currency TEXT NOT NULL CHECK (from_currency IN ('CAD', 'USD', 'INR')),
    to_currency TEXT NOT NULL CHECK (to_currency IN ('CAD', 'USD', 'INR')),
    rate DECIMAL(20,8) NOT NULL,
    date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(from_currency, to_currency, date)
);

CREATE INDEX idx_exchange_rates_currencies_date ON exchange_rates(from_currency, to_currency, date);

-- Holdings table
CREATE TABLE holdings (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    account_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('cash', 'stock', 'etf', 'mutual_fund', 'bond', 'crypto', 'option', 'other')),
    symbol TEXT,
    quantity DECIMAL(20,8),
    cost_basis DECIMAL(20,2),
    currency TEXT CHECK (currency IN ('CAD', 'USD', 'INR')),
    amount DECIMAL(20,2),
    purchase_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CHECK (
        (type = 'cash' AND currency IS NOT NULL AND amount IS NOT NULL) OR
        (type != 'cash' AND symbol IS NOT NULL AND quantity IS NOT NULL)
    )
);

CREATE INDEX idx_holdings_account_id ON holdings(account_id);
CREATE INDEX idx_holdings_type ON holdings(type);
CREATE INDEX idx_holdings_symbol ON holdings(symbol);
CREATE UNIQUE INDEX idx_holdings_account_symbol ON holdings(account_id, symbol) WHERE symbol IS NOT NULL;

-- Holding transactions table
CREATE TABLE holding_transactions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    holding_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('buy', 'sell', 'dividend', 'split', 'transfer', 'deposit', 'withdrawal')),
    quantity DECIMAL(20,8),
    price DECIMAL(20,2),
    total_amount DECIMAL(20,2),
    transaction_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_holding_transactions_holding_id ON holding_transactions(holding_id);
CREATE INDEX idx_holding_transactions_date ON holding_transactions(transaction_date);
CREATE INDEX idx_holding_transactions_type ON holding_transactions(type);

-- Market data table
CREATE TABLE market_data (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    symbol TEXT NOT NULL UNIQUE,
    price DECIMAL(20,2) NOT NULL,
    currency TEXT NOT NULL CHECK (currency IN ('CAD', 'USD', 'INR')),
    last_updated TIMESTAMP WITH TIME ZONE NOT NULL,
    source TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_market_data_symbol ON market_data(symbol);
CREATE INDEX idx_market_data_last_updated ON market_data(last_updated);

-- Projection scenarios table
CREATE TABLE projection_scenarios (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT false,
    config JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_projection_scenarios_user_id ON projection_scenarios(user_id);
CREATE INDEX idx_projection_scenarios_is_default ON projection_scenarios(is_default) WHERE is_default = true;

-- Recurring expenses table
CREATE TABLE recurring_expenses (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    amount DECIMAL(15,2) NOT NULL,
    category TEXT NOT NULL,
    account_id TEXT,
    frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'bi-weekly', 'monthly', 'quarterly', 'annually')),
    day_of_month INTEGER,
    day_of_week INTEGER,
    is_active BOOLEAN NOT NULL DEFAULT true,
    currency TEXT NOT NULL CHECK (currency IN ('CAD', 'USD', 'INR')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_recurring_expenses_user ON recurring_expenses(user_id);
CREATE INDEX idx_recurring_expenses_active ON recurring_expenses(is_active);
CREATE INDEX idx_recurring_expenses_category ON recurring_expenses(category);
CREATE INDEX idx_recurring_expenses_currency ON recurring_expenses(currency);
