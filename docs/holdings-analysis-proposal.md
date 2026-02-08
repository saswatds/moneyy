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

**Gap**: No current price data, no sector/geographic metadata, no ETF look-through analysis.

---

## API Evaluation

### Comparison Matrix

| API | Free Tier | ETF Holdings | Sector Data | Geo Data | Reliability | Best For |
|-----|-----------|--------------|-------------|----------|-------------|----------|
| **Finnhub** | 60 req/min | Yes | Yes | Limited | High | Primary choice |
| **Alpha Vantage** | 25 req/day | Limited | Yes | No | High | Technical indicators |
| **FMP** | 500MB/mo | Premium only | Premium | Premium | High | If budget allows |
| **Yahoo Finance** | Unlimited* | No | Partial | No | Low | Fallback only |
| **Polygon.io** | 5 req/min | No | Limited | No | Very High | Real-time data |
| **Twelve Data** | 800 req/day | No | Limited | No | High | Price data backup |

*Yahoo Finance is unofficial and frequently breaks

---

### Recommended Primary API: Finnhub

**Why Finnhub?**

1. **Most generous free tier**: 60 API calls/minute (vs Alpha Vantage's 25/day)
2. **ETF-specific endpoints**:
   - `/etf/holdings` - Get underlying holdings of an ETF
   - `/etf/sector` - Sector exposure breakdown
   - `/etf/country` - Geographic allocation
   - `/etf/profile` - Fund metadata (expense ratio, AUM, etc.)
3. **Stock fundamentals**: Company profile with sector/industry classification
4. **Real-time quotes**: Current price data for valuation
5. **Good documentation**: Well-maintained with official SDKs

**Finnhub Free Tier Capabilities**:
- 60 calls/minute rate limit
- US market coverage
- 1 year historical data
- Daily updates
- No credit card required

**API Endpoints We'll Use**:
```
GET /quote?symbol={symbol}           # Current price
GET /stock/profile2?symbol={symbol}  # Company sector/industry
GET /etf/holdings?symbol={symbol}    # ETF constituents
GET /etf/sector?symbol={symbol}      # ETF sector breakdown
GET /etf/country?symbol={symbol}     # ETF geographic exposure
```

---

### Recommended Secondary API: Alpha Vantage

**Use Case**: Fallback for data not available in Finnhub, plus technical indicators for future features.

**Key Endpoints**:
```
GET /query?function=GLOBAL_QUOTE&symbol={symbol}
GET /query?function=OVERVIEW&symbol={symbol}  # Company fundamentals
GET /query?function=ETF_PROFILE&symbol={symbol}
```

**Limitation**: 25 requests/day on free tier - use sparingly for cache misses only.

---

### Not Recommended

| API | Reason |
|-----|--------|
| **Yahoo Finance** | Unofficial, breaks frequently, no SLA |
| **FMP** | ETF holdings require $149/mo premium plan |
| **Polygon.io** | Limited ETF data, better for real-time trading |

---

## Proposed Architecture

### Data Model Extensions

```go
// New: Security metadata cache
type SecurityMetadata struct {
    Symbol          string    `json:"symbol"`
    Name            string    `json:"name"`
    Type            string    `json:"type"`  // stock, etf, etc.
    Sector          string    `json:"sector"`
    Industry        string    `json:"industry"`
    Country         string    `json:"country"`
    MarketCap       string    `json:"market_cap"`  // large, mid, small
    Currency        string    `json:"currency"`
    Exchange        string    `json:"exchange"`
    LastUpdated     time.Time `json:"last_updated"`
}

// New: ETF holdings breakdown
type ETFHolding struct {
    ETFSymbol       string  `json:"etf_symbol"`
    HoldingSymbol   string  `json:"holding_symbol"`
    HoldingName     string  `json:"holding_name"`
    Weight          float64 `json:"weight"`  // percentage
    Shares          int64   `json:"shares,omitempty"`
}

// New: ETF allocation data
type ETFAllocation struct {
    Symbol          string             `json:"symbol"`
    SectorWeights   map[string]float64 `json:"sector_weights"`
    CountryWeights  map[string]float64 `json:"country_weights"`
    AssetWeights    map[string]float64 `json:"asset_weights"`
    LastUpdated     time.Time          `json:"last_updated"`
}

// New: Current price cache
type PriceQuote struct {
    Symbol          string    `json:"symbol"`
    Price           float64   `json:"price"`
    Change          float64   `json:"change"`
    ChangePercent   float64   `json:"change_percent"`
    Currency        string    `json:"currency"`
    LastUpdated     time.Time `json:"last_updated"`
}
```

### New API Endpoints

```
GET  /api/holdings/analysis           # Full portfolio analysis
GET  /api/holdings/sector-breakdown   # Sector allocation chart data
GET  /api/holdings/geo-breakdown      # Geographic allocation
GET  /api/holdings/etf/{symbol}/look-through  # ETF underlying holdings
POST /api/holdings/refresh-prices     # Force price refresh
GET  /api/security/{symbol}/metadata  # Individual security info
```

### Caching Strategy

To stay within API rate limits, implement aggressive caching:

| Data Type | Cache Duration | Storage |
|-----------|---------------|---------|
| Stock/ETF prices | 15 minutes | In-memory + SQLite |
| Company metadata | 7 days | SQLite |
| ETF holdings | 1 day | SQLite |
| Sector/Geo allocations | 1 day | SQLite |

**Rate Limit Management**:
- Queue API requests with backoff
- Batch refresh during off-peak hours
- Priority: holdings in user's portfolio first

---

## Feature Set

### Phase 1: Core Analysis (MVP)
1. **Current Market Value**: Fetch real-time prices for all holdings
2. **Sector Breakdown**: Pie/bar chart of portfolio by sector
3. **Asset Type Breakdown**: Stocks vs ETFs vs Bonds vs Cash
4. **Holdings Table Enhancement**: Add current price, gain/loss columns

### Phase 2: ETF Deep Dive
1. **ETF Look-Through**: Expand ETFs to show underlying holdings
2. **Geographic Exposure**: World map or chart showing country allocation
3. **Overlap Analysis**: Detect duplicate holdings across ETFs
4. **Expense Ratio Tracking**: Total portfolio expense ratio

### Phase 3: Advanced Analytics
1. **Market Cap Distribution**: Large/Mid/Small cap breakdown
2. **Dividend Yield Analysis**: Income-generating holdings
3. **Concentration Risk**: Warn on over-concentration in single stock/sector
4. **Historical Performance**: Track portfolio value over time

---

## Frontend Components

New React components needed:

```
src/components/holdings/
├── HoldingsAnalysisDashboard.tsx    # Main analysis view
├── SectorBreakdownChart.tsx         # Pie chart with sector data
├── GeographicExposureChart.tsx      # World map or bar chart
├── AssetAllocationChart.tsx         # Asset class distribution
├── ETFLookThroughTable.tsx          # Expandable ETF holdings
├── HoldingsTable.tsx                # Enhanced table with prices
├── PortfolioSummaryCard.tsx         # Total value, gain/loss
└── ConcentrationWarnings.tsx        # Risk alerts
```

---

## Implementation Estimate

| Phase | Scope | Effort |
|-------|-------|--------|
| Phase 1 | Core analysis + price fetching | 2-3 days |
| Phase 2 | ETF deep dive + geographic | 2-3 days |
| Phase 3 | Advanced analytics | 3-4 days |

**Total**: ~8-10 days for full feature set

---

## API Key Management

Finnhub requires an API key. Options:

1. **User-provided key** (recommended for self-hosted)
   - Add to existing API key management in Settings
   - Store encrypted like Wealthsimple credentials

2. **Proxy through backend**
   - Backend holds the key
   - Protects key from client exposure

The existing `APIKeySection.tsx` and `/api-keys` endpoints can be extended.

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Finnhub rate limits | Aggressive caching, request queuing |
| API downtime | Fallback to Alpha Vantage, graceful degradation |
| Data accuracy | Cross-validate with multiple sources initially |
| International securities | May have gaps - document limitations |
| Cost if scaling | Monitor usage, consider paid tier if needed |

---

## Recommendation

**Start with Finnhub** as the primary API:
- Best free tier for our use case
- Has all required ETF data endpoints
- Well-documented and reliable

**Add Alpha Vantage** as a secondary source:
- Fallback for data gaps
- Useful for future technical analysis features

**Skip FMP for now** unless:
- Budget allows $149/mo for ETF holdings
- Need historical ETF holding changes

---

## Next Steps

1. Sign up for Finnhub free API key
2. Create `internal/market` package for API integration
3. Add database migrations for metadata cache tables
4. Implement Phase 1 backend endpoints
5. Build frontend dashboard components
6. Add to Settings page for API key configuration

---

## References

- [Finnhub API Documentation](https://finnhub.io/docs/api)
- [Finnhub ETF Holdings API](https://finnhub.io/docs/api/etfs-holdings)
- [Alpha Vantage Documentation](https://www.alphavantage.co/documentation/)
- [Financial Modeling Prep ETF APIs](https://site.financialmodelingprep.com/developer/docs/stable/holdings)
