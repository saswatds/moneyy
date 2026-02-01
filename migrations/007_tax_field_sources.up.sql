-- Add field_sources column to track origin of each tax configuration field
-- Stores JSON object mapping field names to their source ("api" or "manual")
-- Example: {"federal_brackets": "api", "cpp_rate": "manual", ...}

ALTER TABLE tax_configurations ADD COLUMN field_sources TEXT DEFAULT '{}';
