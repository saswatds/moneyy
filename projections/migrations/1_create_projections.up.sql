-- Create projection_scenarios table
CREATE TABLE projection_scenarios (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT false,
    config JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create index on user_id for faster queries
CREATE INDEX idx_projection_scenarios_user_id ON projection_scenarios(user_id);

-- Create index on is_default for quick default lookup
CREATE INDEX idx_projection_scenarios_is_default ON projection_scenarios(is_default) WHERE is_default = true;
