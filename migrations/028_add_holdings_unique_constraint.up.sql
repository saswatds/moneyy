-- Add unique constraint to holdings table to prevent duplicate entries for same account/symbol
-- First, remove any duplicate entries (keep the most recent one)
DELETE FROM holdings a USING (
    SELECT account_id, symbol, MAX(updated_at) as max_updated
    FROM holdings
    WHERE symbol IS NOT NULL
    GROUP BY account_id, symbol
    HAVING COUNT(*) > 1
) b
WHERE a.account_id = b.account_id
  AND a.symbol = b.symbol
  AND a.updated_at < b.max_updated;

-- Add unique constraint (only for holdings with symbols)
-- NULL symbols are allowed to have duplicates (cash holdings without symbols)
CREATE UNIQUE INDEX IF NOT EXISTS holdings_account_symbol_unique ON holdings (account_id, symbol)
WHERE symbol IS NOT NULL;
