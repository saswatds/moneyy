# Holdings Analysis System - Proposal Document

## Executive Summary

Build a system to analyze portfolio holdings (stocks, ETFs, mutual funds) and visualize their distribution across multiple facets including:
- **Sector allocation** (Technology, Healthcare, Financials, etc.)
- **Geographic exposure** (US, International, Emerging Markets)
- **Asset class breakdown** (Equities, Bonds, Cash, etc.)
- **Market cap distribution** (Large, Mid, Small cap)
- **Underlying holdings** (for ETFs - see-through analysis)

---

## Current State

The Moneyy application already has:
- Holdings management (`internal/holdings/service.go`)
- Support for holding types: `cash`, `stock`, `etf`, `mutual_fund`, `bond`, `crypto`, `option`, `other`
- Symbol tracking with `quantity` and `cost_basis`
- Multi-currency support (CAD, USD, INR)
- Moneyy API client (`internal/moneyy/client.go`) with API key management
- Assets page (`frontend/src/pages/Assets.tsx`) with holdings table

**Gap**: No current price data, no sector/geographic metadata, no ETF look-through analysis.

---

## Data Source: Moneyy API

All market data will be sourced from the Moneyy API (`https://api.moneyy.app`), which already provides the exact endpoints needed. The Go backend will proxy requests to the Moneyy API (same pattern used for tax brackets/params today).

### Available Endpoints

| Endpoint | Description | Tier |
|----------|-------------|------|
| `GET /api/v1/securities/quote/{symbol}` | Real-time price & trading data | Free |
| `GET /api/v1/securities/quotes?symbols=A,B,C` | Batch quotes (up to 5 free, 25 Pro) | Free/Pro |
| `GET /api/v1/securities/profile/{symbol}` | Company profile (sector, industry, country, market cap) | Free |
| `GET /api/v1/etfs/{symbol}/holdings` | Underlying ETF constituents (10 free, full list Pro) | Free/Pro |
| `GET /api/v1/etfs/{symbol}/sector` | Sector allocation breakdown | Free |
| `GET /api/v1/etfs/{symbol}/country` | Geographic allocation | Pro |
| `GET /api/v1/etfs/{symbol}/profile` | Fund metadata (expense ratio, AUM, inception) | Free |

**Authentication**: Bearer token (already stored encrypted via `internal/apikeys/` service).

---

## Architecture

### Flow

```
Frontend (React)
    ↓ fetch
Go Backend (proxy handlers)
    ↓ HTTP + Bearer token
Moneyy API (api.moneyy.app)
```

This mirrors the existing pattern for tax data: `frontend → /moneyy/tax-brackets → api.moneyy.app/api/v1/tax-brackets`.

### Backend Changes

**Extend `internal/moneyy/client.go`** with new methods:

```go
// Securities
func (c *Client) GetQuote(symbol string) (*QuoteResponse, error)
func (c *Client) GetBatchQuotes(symbols []string) (*BatchQuotesResponse, error)
func (c *Client) GetProfile(symbol string) (*ProfileResponse, error)

// ETFs
func (c *Client) GetETFHoldings(symbol string) (*ETFHoldingsResponse, error)
func (c *Client) GetETFSector(symbol string) (*ETFSectorResponse, error)
func (c *Client) GetETFCountry(symbol string) (*ETFCountryResponse, error)
func (c *Client) GetETFProfile(symbol string) (*ETFProfileResponse, error)
```

**Extend `internal/moneyy/service.go`** with service methods that fetch the API key and call the client.

**New proxy routes** (in `internal/server/handlers/`):

```
GET /moneyy/securities/quote/{symbol}
GET /moneyy/securities/quotes?symbols=AAPL,VTI,XIU
GET /moneyy/securities/profile/{symbol}
GET /moneyy/etfs/{symbol}/holdings
GET /moneyy/etfs/{symbol}/sector
GET /moneyy/etfs/{symbol}/country
GET /moneyy/etfs/{symbol}/profile
```

**New aggregate endpoint** for the analysis dashboard:

```
GET /moneyy/holdings/analysis?accountIds=id1,id2
```

This endpoint will:
1. Fetch all holdings for the given accounts
2. Batch-fetch quotes for all symbols
3. Fetch profiles for stocks, ETF sector/country data for ETFs
4. Aggregate into a single response with sector breakdown, geo breakdown, and valuations

### Response Types

```go
type QuoteResponse struct {
    Symbol        string  `json:"symbol"`
    Price         float64 `json:"price"`
    Change        float64 `json:"change"`
    ChangePercent float64 `json:"change_percent"`
    High          float64 `json:"high"`
    Low           float64 `json:"low"`
    Open          float64 `json:"open"`
    PreviousClose float64 `json:"previous_close"`
    Volume        int64   `json:"volume"`
}

type ProfileResponse struct {
    Symbol     string `json:"symbol"`
    Name       string `json:"name"`
    Sector     string `json:"sector"`
    Industry   string `json:"industry"`
    Country    string `json:"country"`
    MarketCap  int64  `json:"market_cap"`
    Exchange   string `json:"exchange"`
    Currency   string `json:"currency"`
    Logo       string `json:"logo"`
    WebURL     string `json:"web_url"`
}

type ETFHoldingsResponse struct {
    Symbol   string       `json:"symbol"`
    Holdings []ETFHolding `json:"holdings"`
}

type ETFHolding struct {
    Symbol string  `json:"symbol"`
    Name   string  `json:"name"`
    Weight float64 `json:"weight"` // percentage
    Shares int64   `json:"shares,omitempty"`
}

type ETFSectorResponse struct {
    Symbol  string             `json:"symbol"`
    Sectors map[string]float64 `json:"sectors"` // sector -> weight %
}

type ETFCountryResponse struct {
    Symbol    string             `json:"symbol"`
    Countries map[string]float64 `json:"countries"` // country -> weight %
}

type ETFProfileResponse struct {
    Symbol        string  `json:"symbol"`
    Name          string  `json:"name"`
    ExpenseRatio  float64 `json:"expense_ratio"`
    AUM           float64 `json:"aum"`
    InceptionDate string  `json:"inception_date"`
    Description   string  `json:"description"`
}

// Aggregate analysis response
type HoldingsAnalysisResponse struct {
    TotalValue      float64                `json:"total_value"`
    TotalCostBasis  float64                `json:"total_cost_basis"`
    TotalGainLoss   float64                `json:"total_gain_loss"`
    Holdings        []EnrichedHolding      `json:"holdings"`
    SectorBreakdown map[string]float64     `json:"sector_breakdown"`  // sector -> % of portfolio
    GeoBreakdown    map[string]float64     `json:"geo_breakdown"`     // country -> % of portfolio
    TypeBreakdown   map[string]float64     `json:"type_breakdown"`    // stock/etf/bond/cash -> % of portfolio
}

type EnrichedHolding struct {
    Holding                          // embedded original holding
    CurrentPrice   float64           `json:"current_price"`
    MarketValue    float64           `json:"market_value"`
    GainLoss       float64           `json:"gain_loss"`
    GainLossPercent float64          `json:"gain_loss_percent"`
    DayChange      float64           `json:"day_change"`
    DayChangePercent float64         `json:"day_change_percent"`
    Sector         string            `json:"sector,omitempty"`
    Industry       string            `json:"industry,omitempty"`
    Country        string            `json:"country,omitempty"`
    Name           string            `json:"name,omitempty"`
}
```

### Caching Strategy

Cache at the Go backend level using SQLite (same database):

| Data Type | Cache Duration | Rationale |
|-----------|---------------|-----------|
| Quotes | 15 minutes | Prices change frequently but API has rate limits |
| Profiles | 7 days | Company metadata rarely changes |
| ETF holdings | 24 hours | Rebalances are infrequent |
| ETF sector/country | 24 hours | Allocation shifts slowly |

New migration for cache table:

```sql
CREATE TABLE IF NOT EXISTS market_data_cache (
    cache_key TEXT PRIMARY KEY,
    data TEXT NOT NULL,       -- JSON blob
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_market_data_cache_expires ON market_data_cache(expires_at);
```

---

## Frontend Changes

### New API Client Methods

Add to `frontend/src/lib/api-client.ts`:

```typescript
// Securities
async getSecurityQuote(symbol: string): Promise<QuoteResponse>
async getBatchQuotes(symbols: string[]): Promise<Record<string, QuoteResponse>>
async getSecurityProfile(symbol: string): Promise<ProfileResponse>

// ETFs
async getETFHoldings(symbol: string): Promise<ETFHoldingsResponse>
async getETFSector(symbol: string): Promise<ETFSectorResponse>
async getETFCountry(symbol: string): Promise<ETFCountryResponse>
async getETFProfile(symbol: string): Promise<ETFProfileResponse>

// Analysis
async getHoldingsAnalysis(accountIds: string[]): Promise<HoldingsAnalysisResponse>
```

### New React Query Hooks

`frontend/src/hooks/use-market-data.ts`:

```typescript
useSecurityQuote(symbol: string)
useBatchQuotes(symbols: string[])
useSecurityProfile(symbol: string)
useETFHoldings(symbol: string)
useETFSector(symbol: string)
useETFCountry(symbol: string)
useETFProfile(symbol: string)
useHoldingsAnalysis(accountIds: string[])
```

### New Components

```
src/components/holdings/
├── HoldingsAnalysisDashboard.tsx   # Main analysis view (tab on Assets page)
├── SectorBreakdownChart.tsx        # Pie chart - Recharts PieChart
├── GeographicExposureChart.tsx     # Bar chart - country allocation
├── AssetAllocationChart.tsx        # Donut chart - stock/etf/bond/cash split
├── EnrichedHoldingsTable.tsx       # Table with live prices, gain/loss, day change
├── PortfolioSummaryCards.tsx       # Total value, gain/loss, day change cards
└── ETFLookThroughTable.tsx         # Expandable ETF → underlying holdings
```

All charts will use **Recharts** (already installed) with the existing `<ChartContainer>` wrapper from `src/components/ui/chart.tsx`.

### Updated Assets Page

The existing `Assets.tsx` page will be enhanced with:
1. **Summary cards** showing total market value (from live prices), total gain/loss, day change
2. **Analysis tabs**: Sector | Geography | Asset Type | Holdings
3. **Enhanced holdings table** with current price, market value, gain/loss columns
4. **ETF drill-down**: Click an ETF row to see its underlying holdings, sector, and country exposure

---

## Feature Set

### Phase 1: Live Prices & Enhanced Table
1. Backend: Add quote/profile proxy endpoints + cache
2. Frontend: Batch-fetch quotes for all holdings
3. Enhanced holdings table: current price, market value, gain/loss, day change
4. Portfolio summary cards with live total value

### Phase 2: Sector & Asset Analysis
1. Backend: Add ETF sector endpoint + aggregate analysis endpoint
2. Frontend: Sector breakdown pie chart
3. Frontend: Asset type donut chart (stocks vs ETFs vs bonds vs cash)
4. Frontend: Tab navigation on Assets page

### Phase 3: ETF Deep Dive & Geography
1. Backend: Add ETF holdings/country/profile endpoints
2. Frontend: ETF look-through table (expand to see underlying holdings)
3. Frontend: Geographic exposure chart
4. Frontend: ETF profile cards (expense ratio, AUM)

---

## API Key Requirement

The Moneyy API key is already managed via:
- Backend: `internal/apikeys/service.go` (encrypted storage)
- Frontend: `src/components/settings/APIKeySection.tsx`
- Settings page already has the "Moneyy" provider configured

No additional API key setup is needed. Users who have configured their Moneyy API key for tax data will automatically have access to market data endpoints.

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Free tier limits (5 batch quotes) | Cache aggressively, stagger refreshes |
| Pro-only features (ETF country, full holdings) | Graceful degradation - show available data, prompt upgrade |
| API downtime | Cache serves stale data with "last updated" indicator |
| Rate limiting | Backend queues requests, respects rate limits |
| Large portfolios (many symbols) | Batch quotes endpoint, paginated refresh |

---

## Next Steps

1. Add new client methods to `internal/moneyy/client.go`
2. Add service methods to `internal/moneyy/service.go`
3. Add cache migration
4. Add proxy handler routes
5. Add frontend API client methods and hooks
6. Build Phase 1 (live prices + enhanced table)
7. Build Phase 2 (sector/asset charts)
8. Build Phase 3 (ETF deep dive + geography)
