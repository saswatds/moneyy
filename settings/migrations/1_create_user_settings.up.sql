-- Create user_settings table
CREATE TABLE user_settings (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    user_id TEXT NOT NULL UNIQUE,
    base_currency TEXT NOT NULL CHECK (base_currency IN ('CAD', 'USD', 'INR')) DEFAULT 'CAD',
    theme TEXT NOT NULL DEFAULT 'light',
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create index on user_id for faster lookups
CREATE INDEX idx_user_settings_user_id ON user_settings(user_id);
