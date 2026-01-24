# Personal Finance Dashboard - Technical Specification

## 1. Overview

A comprehensive personal finance dashboard for tracking financial accounts, assets, debts, and net worth across multiple currencies (CAD, USD, INR). The system provides historical tracking and future projections to help users understand their financial trajectory.

## 2. Tech Stack

### Backend
- **Framework**: Encore.dev (Go)
- **Database**: PostgreSQL (provided by Encore)
- **Authentication**: Encore auth handlers
- **API**: RESTful endpoints with type-safe code generation

### Frontend
- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite
- **UI Library**: shadcn/ui (Radix UI + Tailwind CSS)
- **State Management**: React Query (TanStack Query)
- **Charts**: Recharts
- **Date Handling**: date-fns
- **Forms**: React Hook Form + Zod validation
- **Routing**: React Router

## 3. Core Features

### 3.1 Account Management

#### Manual Accounts
- Add/edit/delete financial accounts manually
- Support account types:
  - **Cash & Banking**: Checking, Savings, Cash
  - **Investments**: Brokerage, TFSA, RRSP, Stocks, Crypto
  - **Assets**: Real Estate, Vehicles, Collectibles, Other
  - **Liabilities**: Credit Cards, Loans, Mortgage, Line of Credit

#### Connections & Synced Accounts
- **Connections**: Integrations with financial institutions (e.g., Wealthsimple)
- **Synced Accounts**: Accounts automatically synced from connections
- One connection can have multiple synced accounts
- Synced accounts automatically update balances and holdings
- Examples:
  - Wealthsimple connection → Multiple accounts (TFSA, RRSP, Cash)
  - Each Wealthsimple account becomes a synced account in the system
- Synced accounts are read-only (managed by the connection)
- See SPEC_WEALTHSIMPLE_SYNC.md for detailed implementation

### 3.2 Multi-Currency Support
- Primary currencies: CAD, USD, INR
- Real-time exchange rates (daily refresh)
- Base currency selection for consolidated views
- Per-account currency designation
- Historical exchange rate tracking

### 3.3 Balance Tracking
- Manual balance entry with timestamp
- Balance history timeline
- Support for negative balances (debts)
- Bulk import from CSV

### 3.4 Net Worth Dashboard
- Current net worth calculation
- Assets vs Liabilities breakdown
- Net worth trend over time
- Currency-wise breakdown
- Account type distribution

### 3.5 Projections
- Future balance projections based on:
  - Historical growth rates
  - Manual expected returns (%)
  - Expected monthly contributions/withdrawals
- Projection timeline: 1 month, 3 months, 6 months, 1 year, 5 years, 10 years
- Goal setting and tracking

### 3.6 Analytics & Insights
- Net worth growth rate
- Best/worst performing accounts
- Asset allocation pie charts
- Historical trends (line charts)
- Month-over-month comparisons

## 4. Data Models

### 4.1 Account
```go
type AccountType string

const (
    AccountTypeChecking      AccountType = "checking"
    AccountTypeSavings       AccountType = "savings"
    AccountTypeCash          AccountType = "cash"
    AccountTypeBrokerage     AccountType = "brokerage"
    AccountTypeTFSA          AccountType = "tfsa"
    AccountTypeRRSP          AccountType = "rrsp"
    AccountTypeStocks        AccountType = "stocks"
    AccountTypeCrypto        AccountType = "crypto"
    AccountTypeRealEstate    AccountType = "real_estate"
    AccountTypeVehicle       AccountType = "vehicle"
    AccountTypeCollectible   AccountType = "collectible"
    AccountTypeCreditCard    AccountType = "credit_card"
    AccountTypeLoan          AccountType = "loan"
    AccountTypeMortgage      AccountType = "mortgage"
    AccountTypeLineOfCredit  AccountType = "line_of_credit"
    AccountTypeOther         AccountType = "other"
)

type Currency string

const (
    CurrencyCAD Currency = "CAD"
    CurrencyUSD Currency = "USD"
    CurrencyINR Currency = "INR"
)

type Account struct {
    ID           string      `json:"id"`
    UserID       string      `json:"user_id"`
    Name         string      `json:"name"`
    Type         AccountType `json:"type"`
    Currency     Currency    `json:"currency"`
    Institution  string      `json:"institution,omitempty"`
    IsAsset      bool        `json:"is_asset"`
    IsActive     bool        `json:"is_active"`
    IsSynced     bool        `json:"is_synced"`         // true if managed by a connection
    ConnectionID string      `json:"connection_id,omitempty"` // reference to Connection if synced
    CreatedAt    time.Time   `json:"created_at"`
    UpdatedAt    time.Time   `json:"updated_at"`
}
```

### 4.2 Connection
```go
type ConnectionProvider string

const (
    ConnectionProviderWealthsimple ConnectionProvider = "wealthsimple"
    // Future: ConnectionProviderQuestrade, etc.
)

type ConnectionStatus string

const (
    ConnectionStatusConnected    ConnectionStatus = "connected"
    ConnectionStatusDisconnected ConnectionStatus = "disconnected"
    ConnectionStatusError        ConnectionStatus = "error"
    ConnectionStatusSyncing      ConnectionStatus = "syncing"
)

type Connection struct {
    ID             string             `json:"id"`
    UserID         string             `json:"user_id"`
    Provider       ConnectionProvider `json:"provider"`
    Name           string             `json:"name"`           // e.g., "Wealthsimple - user@example.com"
    Status         ConnectionStatus   `json:"status"`
    LastSyncAt     *time.Time         `json:"last_sync_at,omitempty"`
    LastSyncError  string             `json:"last_sync_error,omitempty"`
    SyncFrequency  string             `json:"sync_frequency"` // "daily", "hourly", "manual"
    AccountCount   int                `json:"account_count"`  // number of synced accounts
    CreatedAt      time.Time          `json:"created_at"`
    UpdatedAt      time.Time          `json:"updated_at"`
}
```

### 4.3 SyncedAccount
```go
type SyncedAccount struct {
    ID                string    `json:"id"`
    ConnectionID      string    `json:"connection_id"`      // references Connection
    LocalAccountID    string    `json:"local_account_id"`   // references Account
    ProviderAccountID string    `json:"provider_account_id"` // account ID from provider (e.g., Wealthsimple)
    LastSyncAt        *time.Time `json:"last_sync_at,omitempty"`
    CreatedAt         time.Time `json:"created_at"`
    UpdatedAt         time.Time `json:"updated_at"`
}
```

**Relationship**:
- Connection (1) → SyncedAccount (many) → Account (1)
- One Connection has multiple SyncedAccounts
- Each SyncedAccount links to one local Account
- Accounts with `is_synced=true` cannot be manually edited

### 4.4 Balance
```go
type Balance struct {
    ID        string    `json:"id"`
    AccountID string    `json:"account_id"`
    Amount    float64   `json:"amount"`
    Date      time.Time `json:"date"`
    Notes     string    `json:"notes,omitempty"`
    CreatedAt time.Time `json:"created_at"`
}
```

### 4.3 ExchangeRate
```go
type ExchangeRate struct {
    ID           string    `json:"id"`
    FromCurrency Currency  `json:"from_currency"`
    ToCurrency   Currency  `json:"to_currency"`
    Rate         float64   `json:"rate"`
    Date         time.Time `json:"date"`
    CreatedAt    time.Time `json:"created_at"`
}
```

### 4.4 Projection
```go
type ProjectionType string

const (
    ProjectionTypeHistorical  ProjectionType = "historical"
    ProjectionTypeManual      ProjectionType = "manual"
    ProjectionTypeContribution ProjectionType = "contribution"
)

type Projection struct {
    ID                    string         `json:"id"`
    AccountID             string         `json:"account_id"`
    AnnualReturnRate      float64        `json:"annual_return_rate"`
    MonthlyContribution   float64        `json:"monthly_contribution"`
    ProjectionType        ProjectionType `json:"projection_type"`
    IsActive              bool           `json:"is_active"`
    CreatedAt             time.Time      `json:"created_at"`
    UpdatedAt             time.Time      `json:"updated_at"`
}
```

### 4.5 User Settings
```go
type UserSettings struct {
    ID              string   `json:"id"`
    UserID          string   `json:"user_id"`
    BaseCurrency    Currency `json:"base_currency"`
    Theme           string   `json:"theme"`
    UpdatedAt       time.Time `json:"updated_at"`
}
```

## 5. API Endpoints

### 5.1 Accounts Service
```
POST   /accounts                    - Create account
GET    /accounts                    - List all accounts
GET    /accounts/:id                - Get account details
PUT    /accounts/:id                - Update account
DELETE /accounts/:id                - Delete account
GET    /accounts/:id/balances       - Get account balance history
POST   /accounts/:id/balances       - Add balance entry
GET    /accounts/summary            - Get accounts summary
```

### 5.2 Balances Service
```
POST   /balances                    - Create balance entry
GET    /balances/:id                - Get balance details
PUT    /balances/:id                - Update balance
DELETE /balances/:id                - Delete balance
POST   /balances/bulk               - Bulk import balances
```

### 5.3 Currency Service
```
GET    /exchange-rates              - Get latest exchange rates
GET    /exchange-rates/historical   - Get historical rates
POST   /exchange-rates/refresh      - Refresh rates (admin/cron)
GET    /convert                     - Convert amount between currencies
```

### 5.4 Dashboard Service
```
GET    /dashboard/networth          - Current net worth
GET    /dashboard/networth/history  - Net worth over time
GET    /dashboard/breakdown         - Assets/Liabilities breakdown
GET    /dashboard/allocation        - Asset allocation
```

### 5.5 Projections Service
```
POST   /projections                 - Create projection config
GET    /projections/accounts/:id    - Get account projections
PUT    /projections/:id             - Update projection
DELETE /projections/:id             - Delete projection
GET    /projections/calculate       - Calculate future projections
```

### 5.6 Settings Service
```
GET    /settings                    - Get user settings
PUT    /settings                    - Update user settings
```

## 6. Frontend Structure

### 6.1 Pages
```
/                          - Dashboard (net worth overview)
/accounts                  - Accounts list
/accounts/new              - Create account
/accounts/:id              - Account details & history
/accounts/:id/edit         - Edit account
/projections               - Future projections view
/analytics                 - Charts and insights
/settings                  - User settings
```

### 6.2 Key Components (shadcn/ui)

#### Layout Components
- `DashboardLayout` - Main app layout with sidebar
- `Header` - Top navigation with user menu
- `Sidebar` - Navigation menu

#### Data Display
- `NetWorthCard` - Current net worth display
- `AccountCard` - Individual account summary
- `BalanceHistoryChart` - Line chart for balance trends
- `AssetAllocationChart` - Pie/donut chart for allocation
- `NetWorthTrendChart` - Historical net worth line chart
- `ProjectionChart` - Future projection visualization

#### Forms
- `AccountForm` - Create/edit account
- `BalanceForm` - Add balance entry
- `ProjectionForm` - Configure projections
- `CurrencySelect` - Currency dropdown
- `AccountTypeSelect` - Account type selector

#### Tables
- `AccountsTable` - Sortable accounts list
- `BalanceHistoryTable` - Balance entries table

#### Utilities
- `CurrencyDisplay` - Format currency with symbol
- `PercentageDisplay` - Format percentage values
- `DateDisplay` - Format dates consistently
- `LoadingState` - Loading skeletons
- `EmptyState` - Empty state illustrations

### 6.3 State Management

Use React Query for:
- Fetching accounts, balances, exchange rates
- Optimistic updates
- Cache invalidation
- Background refetching

```typescript
// Example query hooks
useAccounts()
useAccount(id)
useBalanceHistory(accountId)
useNetWorth()
useExchangeRates()
useProjections(accountId)
```

## 7. Currency Handling

### 7.1 Exchange Rate Provider
- Use a free API (e.g., exchangerate-api.io, frankfurter.app)
- Daily scheduled refresh via Encore cron job
- Fallback to last known rates if API unavailable
- Store historical rates for accurate calculations

### 7.2 Conversion Logic
- Always store amounts in original currency
- Convert on-demand for display
- Use date-specific exchange rates for historical data
- Support manual rate override for specific dates

### 7.3 Base Currency
- User selects preferred base currency
- All aggregated views show values in base currency
- Original currency shown as secondary info
- Easy toggle between currencies in UI

## 8. Projection Algorithms

### 8.1 Historical Growth Method
```
Future Value = Current Value × (1 + avg_growth_rate)^years
```
- Calculate average growth rate from historical data
- Minimum 3 data points required
- Weighted average (recent data weighted higher)

### 8.2 Manual Return Method
```
Future Value = Current Value × (1 + annual_return_rate)^years
```
- User specifies expected annual return
- Simple compound interest calculation

### 8.3 Contribution Method
```
Future Value = PV × (1 + r)^n + PMT × [((1 + r)^n - 1) / r]
Where:
  PV = Present Value
  r = annual_return_rate / 12
  n = months
  PMT = monthly_contribution
```

### 8.4 Combined Projections
- Support multiple projection scenarios per account
- Show optimistic/realistic/pessimistic views
- Total portfolio projection

## 9. Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Set up database schema and migrations
- [ ] Implement Account service (CRUD)
- [ ] Implement Balance service (CRUD)
- [ ] Set up shadcn/ui in frontend
- [ ] Create basic layout and navigation
- [ ] Implement authentication

### Phase 2: Core Features (Week 3-4)
- [ ] Currency service with exchange rates
- [ ] Dashboard service for net worth calculation
- [ ] Account list and detail pages
- [ ] Balance entry forms
- [ ] Basic charts (net worth trend)

### Phase 3: Analytics (Week 5-6)
- [ ] Asset allocation calculations
- [ ] Historical trend charts
- [ ] Account performance analytics
- [ ] Advanced filtering and sorting

### Phase 4: Projections (Week 7-8)
- [ ] Projection service implementation
- [ ] Projection algorithms
- [ ] Future value calculations
- [ ] Projection visualization
- [ ] Goal setting features

### Phase 5: Polish (Week 9-10)
- [ ] CSV import/export
- [ ] Dark mode support
- [ ] Responsive mobile design
- [ ] Performance optimization
- [ ] Error handling and validation
- [ ] User documentation

## 10. Security Considerations

- User authentication required for all endpoints
- Row-level security (users can only access their data)
- Input validation on all forms
- SQL injection prevention (use parameterized queries)
- XSS prevention (sanitize inputs)
- Rate limiting on API endpoints
- HTTPS only in production

## 11. Future Enhancements

- Automatic bank account syncing (Plaid/Finicity)
- Receipt scanning and expense tracking
- Budget planning and tracking
- Bill reminders
- Investment performance tracking
- Tax planning features
- Multi-user support (household finances)
- Mobile app (React Native)
- Recurring transaction automation
- Financial goal milestones
- Notifications and alerts
- Export to PDF reports
- Integration with accounting software

## 12. Non-Functional Requirements

### Performance
- Page load time < 2 seconds
- API response time < 500ms
- Support 1000+ balance entries per account
- Efficient chart rendering for large datasets

### Scalability
- Support multiple users
- Handle 100+ accounts per user
- Historical data retention: unlimited

### Reliability
- 99.9% uptime target
- Automated backups (daily)
- Data export capability

### Usability
- Intuitive UI/UX
- Mobile-responsive
- Accessibility (WCAG 2.1 AA)
- Keyboard navigation support

---

## Development Guidelines

- Follow Go best practices for backend
- Use TypeScript strict mode
- Write tests for critical business logic
- Document API endpoints
- Use semantic commit messages
- Keep components small and focused
- Use Tailwind utility classes
- Follow shadcn/ui component patterns
