CREATE TABLE IF NOT EXISTS asset_details (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

    -- Core Asset Fields
    asset_type TEXT NOT NULL CHECK (asset_type IN ('real_estate', 'vehicle', 'collectible', 'equipment')),
    purchase_price DECIMAL(15, 2) NOT NULL,
    purchase_date DATE NOT NULL,

    -- Depreciation Configuration
    depreciation_method TEXT NOT NULL CHECK (depreciation_method IN ('straight_line', 'declining_balance', 'manual')),
    useful_life_years INTEGER, -- required for straight_line
    salvage_value DECIMAL(15, 2) DEFAULT 0, -- for straight_line
    depreciation_rate DECIMAL(5, 4), -- required for declining_balance (e.g., 0.20 for 20%)

    -- Type-Specific Data (JSONB for flexibility)
    type_specific_data JSONB,

    -- Metadata
    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(account_id)
);

-- Manual depreciation tracking table
CREATE TABLE IF NOT EXISTS asset_depreciation_entries (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

    entry_date DATE NOT NULL,
    current_value DECIMAL(15, 2) NOT NULL,
    accumulated_depreciation DECIMAL(15, 2) NOT NULL,

    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(account_id, entry_date)
);

CREATE INDEX IF NOT EXISTS idx_asset_details_account ON asset_details(account_id);
CREATE INDEX IF NOT EXISTS idx_asset_details_type ON asset_details(asset_type);
CREATE INDEX IF NOT EXISTS idx_asset_depreciation_account ON asset_depreciation_entries(account_id);
CREATE INDEX IF NOT EXISTS idx_asset_depreciation_date ON asset_depreciation_entries(account_id, entry_date);
