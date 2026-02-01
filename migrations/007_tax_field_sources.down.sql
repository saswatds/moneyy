-- Remove field_sources column from tax_configurations
-- Note: SQLite doesn't support DROP COLUMN directly in older versions
-- This creates a new table without the column and migrates data

CREATE TABLE tax_configurations_backup AS SELECT
    id, user_id, tax_year, province, federal_brackets, provincial_brackets,
    cpp_rate, cpp_max_pensionable_earnings, cpp_basic_exemption,
    ei_rate, ei_max_insurable_earnings, basic_personal_amount,
    created_at, updated_at
FROM tax_configurations;

DROP TABLE tax_configurations;

ALTER TABLE tax_configurations_backup RENAME TO tax_configurations;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_tax_configurations_user ON tax_configurations(user_id);
CREATE INDEX IF NOT EXISTS idx_tax_configurations_user_year ON tax_configurations(user_id, tax_year);
