-- Drop income and tax tables (SQLite)

-- Drop indexes first
DROP INDEX IF EXISTS idx_annual_income_summaries_user_year;
DROP INDEX IF EXISTS idx_annual_income_summaries_user;
DROP INDEX IF EXISTS idx_tax_configurations_user_year;
DROP INDEX IF EXISTS idx_tax_configurations_user;
DROP INDEX IF EXISTS idx_income_records_user_year;
DROP INDEX IF EXISTS idx_income_records_category;
DROP INDEX IF EXISTS idx_income_records_year;
DROP INDEX IF EXISTS idx_income_records_user;

-- Drop tables in reverse order
DROP TABLE IF EXISTS annual_income_summaries;
DROP TABLE IF EXISTS tax_configurations;
DROP TABLE IF EXISTS income_records;
