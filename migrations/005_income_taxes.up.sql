-- 1. income_records - Individual income entries
CREATE TABLE income_records (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    user_id TEXT NOT NULL,
    source TEXT NOT NULL,  -- e.g., "ABC Corp", "Rental Property 1", "Consulting"
    category TEXT NOT NULL CHECK (category IN ('employment', 'investment', 'rental', 'business', 'other')),
    amount DECIMAL(15,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'CAD' CHECK (currency IN ('CAD', 'USD', 'INR')),
    frequency TEXT NOT NULL DEFAULT 'one_time' CHECK (frequency IN ('one_time', 'monthly', 'bi-weekly', 'annually')),
    tax_year INTEGER NOT NULL,
    date_received DATE,  -- For one-time income
    description TEXT,
    is_taxable BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 2. tax_configurations - Per-user tax settings per year
CREATE TABLE tax_configurations (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    user_id TEXT NOT NULL,
    tax_year INTEGER NOT NULL,
    province TEXT NOT NULL DEFAULT 'ON',  -- Canadian province code
    federal_brackets JSONB NOT NULL DEFAULT '[]'::jsonb,  -- Array of {up_to_income, rate}
    provincial_brackets JSONB NOT NULL DEFAULT '[]'::jsonb,  -- Array of {up_to_income, rate}
    cpp_rate DECIMAL(5,4) DEFAULT 0.0595,  -- CPP contribution rate
    cpp_max_pensionable_earnings DECIMAL(10,2) DEFAULT 68500,  -- Max pensionable earnings for CPP
    cpp_basic_exemption DECIMAL(10,2) DEFAULT 3500,  -- CPP basic exemption
    ei_rate DECIMAL(5,4) DEFAULT 0.0163,  -- EI rate
    ei_max_insurable_earnings DECIMAL(10,2) DEFAULT 63200,  -- Max insurable earnings for EI
    basic_personal_amount DECIMAL(10,2) DEFAULT 15705,  -- Federal basic personal amount
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, tax_year)
);

-- 3. annual_income_summaries - Pre-computed annual totals for performance
CREATE TABLE annual_income_summaries (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    user_id TEXT NOT NULL,
    tax_year INTEGER NOT NULL,
    total_gross_income DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_taxable_income DECIMAL(15,2) NOT NULL DEFAULT 0,
    employment_income DECIMAL(15,2) NOT NULL DEFAULT 0,
    investment_income DECIMAL(15,2) NOT NULL DEFAULT 0,
    rental_income DECIMAL(15,2) NOT NULL DEFAULT 0,
    business_income DECIMAL(15,2) NOT NULL DEFAULT 0,
    other_income DECIMAL(15,2) NOT NULL DEFAULT 0,
    stock_options_benefit DECIMAL(15,2) NOT NULL DEFAULT 0,  -- From equity_exercises
    federal_tax DECIMAL(15,2) NOT NULL DEFAULT 0,
    provincial_tax DECIMAL(15,2) NOT NULL DEFAULT 0,
    cpp_contribution DECIMAL(15,2) NOT NULL DEFAULT 0,
    ei_contribution DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_tax DECIMAL(15,2) NOT NULL DEFAULT 0,
    net_income DECIMAL(15,2) NOT NULL DEFAULT 0,
    effective_tax_rate DECIMAL(5,4) NOT NULL DEFAULT 0,
    marginal_tax_rate DECIMAL(5,4) NOT NULL DEFAULT 0,
    computed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, tax_year)
);

-- Indexes
CREATE INDEX idx_income_records_user ON income_records(user_id);
CREATE INDEX idx_income_records_year ON income_records(tax_year);
CREATE INDEX idx_income_records_category ON income_records(category);
CREATE INDEX idx_income_records_user_year ON income_records(user_id, tax_year);
CREATE INDEX idx_tax_configurations_user ON tax_configurations(user_id);
CREATE INDEX idx_tax_configurations_user_year ON tax_configurations(user_id, tax_year);
CREATE INDEX idx_annual_income_summaries_user ON annual_income_summaries(user_id);
CREATE INDEX idx_annual_income_summaries_user_year ON annual_income_summaries(user_id, tax_year);

-- Insert default Canadian federal tax brackets for 2024
-- Note: These are sample rates; users can customize via tax_configurations
