CREATE TABLE IF NOT EXISTS market_data_cache (
    cache_key TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_market_data_cache_expires ON market_data_cache(expires_at);
