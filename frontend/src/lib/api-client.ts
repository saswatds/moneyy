// API client for communicating with the Encore backend
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: string;
  currency: 'CAD' | 'USD' | 'INR';
  institution?: string;
  is_asset: boolean;
  is_active: boolean;
  is_synced: boolean;
  connection_id?: string;
  created_at: string;
  updated_at: string;
  current_balance?: number;
}

export interface Balance {
  id: string;
  account_id: string;
  amount: number;
  date: string;
  notes?: string;
  created_at: string;
}

export interface Holding {
  id: string;
  account_id: string;
  type: 'cash' | 'stock' | 'etf' | 'mutual_fund' | 'bond' | 'crypto' | 'option' | 'other';
  symbol?: string;
  quantity?: number;
  cost_basis?: number;
  currency?: 'CAD' | 'USD' | 'INR';
  amount?: number;
  purchase_date?: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface CreateAccountRequest {
  name: string;
  type: string;
  currency: 'CAD' | 'USD' | 'INR';
  institution?: string;
  is_asset: boolean;
}

export interface CreateBalanceRequest {
  account_id: string;
  amount: number;
  date: string;
  notes?: string;
}

export interface CreateHoldingRequest {
  account_id: string;
  type: 'cash' | 'stock' | 'etf' | 'mutual_fund' | 'bond' | 'crypto' | 'option' | 'other';
  symbol?: string;
  quantity?: number;
  cost_basis?: number;
  currency?: string;
  amount?: number;
  purchase_date?: string;
  notes?: string;
}

export interface UpdateHoldingRequest {
  quantity?: number;
  cost_basis?: number;
  amount?: number;
  notes?: string;
}

export interface ExchangeRates {
  rates: Record<string, Record<string, number>>;
  date: string;
}

export interface MortgageDetails {
  id: string;
  account_id: string;
  original_amount: number;
  interest_rate: number;
  rate_type: 'fixed' | 'variable';
  start_date: string;
  term_months: number;
  amortization_months: number;
  payment_amount: number;
  payment_frequency: 'weekly' | 'bi-weekly' | 'semi-monthly' | 'monthly';
  payment_day?: number;
  property_address?: string;
  property_city?: string;
  property_province?: string;
  property_postal_code?: string;
  property_value?: number;
  renewal_date?: string;
  maturity_date: string;
  lender?: string;
  mortgage_number?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface MortgagePayment {
  id: string;
  account_id: string;
  payment_date: string;
  payment_amount: number;
  principal_amount: number;
  interest_amount: number;
  extra_payment: number;
  balance_after: number;
  notes?: string;
  created_at: string;
}

export interface AmortizationEntry {
  payment_number: number;
  payment_date: string;
  payment_amount: number;
  principal_amount: number;
  interest_amount: number;
  balance_after: number;
}

export interface CreateMortgageDetailsRequest {
  account_id: string;
  original_amount: number;
  interest_rate: number;
  rate_type: 'fixed' | 'variable';
  start_date: string;
  term_months: number;
  amortization_months: number;
  payment_amount: number;
  payment_frequency: 'weekly' | 'bi-weekly' | 'semi-monthly' | 'monthly';
  payment_day?: number;
  property_address?: string;
  property_city?: string;
  property_province?: string;
  property_postal_code?: string;
  property_value?: number;
  renewal_date?: string;
  lender?: string;
  mortgage_number?: string;
  notes?: string;
}

export interface CreateMortgagePaymentRequest {
  account_id: string;
  payment_date: string;
  payment_amount: number;
  principal_amount: number;
  interest_amount: number;
  extra_payment: number;
  notes?: string;
}

export interface LoanDetails {
  id: string;
  account_id: string;
  original_amount: number;
  interest_rate: number;
  rate_type: 'fixed' | 'variable';
  start_date: string;
  term_months: number;
  payment_amount: number;
  payment_frequency: 'weekly' | 'bi-weekly' | 'semi-monthly' | 'monthly';
  payment_day?: number;
  loan_type?: string;
  lender?: string;
  loan_number?: string;
  purpose?: string;
  maturity_date: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface LoanPayment {
  id: string;
  account_id: string;
  payment_date: string;
  payment_amount: number;
  principal_amount: number;
  interest_amount: number;
  extra_payment: number;
  balance_after: number;
  notes?: string;
  created_at: string;
}

export interface CreateLoanDetailsRequest {
  account_id: string;
  original_amount: number;
  interest_rate: number;
  rate_type: 'fixed' | 'variable';
  start_date: string;
  term_months: number;
  payment_amount: number;
  payment_frequency: 'weekly' | 'bi-weekly' | 'semi-monthly' | 'monthly';
  payment_day?: number;
  loan_type?: string;
  lender?: string;
  loan_number?: string;
  purpose?: string;
  notes?: string;
}

export interface CreateLoanPaymentRequest {
  account_id: string;
  payment_date: string;
  payment_amount: number;
  principal_amount: number;
  interest_amount: number;
  extra_payment: number;
  notes?: string;
}

export interface AssetDetails {
  id: string;
  account_id: string;
  asset_type: 'real_estate' | 'vehicle' | 'collectible' | 'equipment';
  purchase_price: number;
  purchase_date: string;
  depreciation_method: 'straight_line' | 'declining_balance' | 'manual';
  useful_life_years?: number;
  salvage_value: number;
  depreciation_rate?: number;
  type_specific_data?: Record<string, any>;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface AssetWithCurrentValue extends AssetDetails {
  current_value: number;
  accumulated_depreciation: number;
  as_of_date: string;
}

export interface DepreciationEntry {
  id: string;
  account_id: string;
  entry_date: string;
  current_value: number;
  accumulated_depreciation: number;
  notes?: string;
  created_at: string;
}

export interface DepreciationScheduleEntry {
  year: number;
  date: string;
  depreciation_amount: number;
  accumulated_depreciation: number;
  book_value: number;
}

export interface CreateAssetDetailsRequest {
  account_id: string;
  asset_type: 'real_estate' | 'vehicle' | 'collectible' | 'equipment';
  purchase_price: number;
  purchase_date: string;
  depreciation_method: 'straight_line' | 'declining_balance' | 'manual';
  useful_life_years?: number;
  salvage_value: number;
  depreciation_rate?: number;
  type_specific_data?: Record<string, any>;
  notes?: string;
}

export interface UpdateAssetDetailsRequest {
  asset_type: 'real_estate' | 'vehicle' | 'collectible' | 'equipment';
  purchase_price: number;
  purchase_date: string;
  depreciation_method: 'straight_line' | 'declining_balance' | 'manual';
  useful_life_years?: number;
  salvage_value: number;
  depreciation_rate?: number;
  type_specific_data?: Record<string, any>;
  notes?: string;
}

export interface CreateDepreciationEntryRequest {
  account_id: string;
  entry_date: string;
  current_value: number;
  notes?: string;
}

export interface TaxBracket {
  up_to_income: number; // 0 = unlimited
  rate: number;
}

export interface ProjectionConfig {
  time_horizon_years: number;
  inflation_rate: number;
  annual_salary: number;
  annual_salary_growth: number;
  federal_tax_brackets: TaxBracket[];
  provincial_tax_brackets: TaxBracket[];
  monthly_expenses: number;
  annual_expense_growth: number;
  monthly_savings_rate: number; // % of net income
  investment_returns: Record<string, number>;
  extra_debt_payments: Record<string, number>;
  one_time_expenses: OneTimeExpense[];
  one_time_incomes: OneTimeIncome[];
  asset_appreciation: Record<string, number>;
  savings_allocation: Record<string, number>;
}

export interface OneTimeExpense {
  date: string;
  amount: number;
  description: string;
}

export interface OneTimeIncome {
  date: string;
  amount: number;
  description: string;
}

export interface ProjectionScenario {
  id: string;
  user_id: string;
  name: string;
  is_default: boolean;
  config: ProjectionConfig;
  created_at: string;
  updated_at: string;
}

export interface DataPoint {
  date: string;
  value: number;
}

export interface CashFlowPoint {
  date: string;
  income: number;
  expenses: number;
  net: number;
}

export interface AssetBreakdownPoint {
  date: string;
  assets: Record<string, number>;
}

export interface DebtPayoffPoint {
  date: string;
  debts: Record<string, number>;
  total_debt: number;
}

export interface ProjectionResponse {
  net_worth: DataPoint[];
  assets: DataPoint[];
  liabilities: DataPoint[];
  cash_flow: CashFlowPoint[];
  asset_breakdown: AssetBreakdownPoint[];
  debt_payoff: DebtPayoffPoint[];
}

export interface CalculateProjectionRequest {
  config: ProjectionConfig;
}

export interface CreateScenarioRequest {
  name: string;
  is_default: boolean;
  config: ProjectionConfig;
}

export interface UpdateScenarioRequest {
  name?: string;
  is_default?: boolean;
  config?: ProjectionConfig;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }

  // Account endpoints
  async getAccounts(): Promise<{ accounts: Account[] }> {
    return this.request('/accounts');
  }

  async getAccountsWithBalance(): Promise<{ accounts: Account[] }> {
    return this.request('/accounts-with-balance');
  }

  async getAccount(id: string): Promise<Account> {
    return this.request(`/accounts/${id}`);
  }

  async createAccount(data: CreateAccountRequest): Promise<Account> {
    return this.request('/accounts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAccount(id: string, data: Partial<CreateAccountRequest>): Promise<Account> {
    return this.request(`/accounts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteAccount(id: string): Promise<{ success: boolean }> {
    return this.request(`/accounts/${id}`, {
      method: 'DELETE',
    });
  }

  async getAccountsSummary(): Promise<any> {
    return this.request('/summary/accounts');
  }

  // Balance endpoints
  async getAccountBalances(accountId: string): Promise<{ balances: Balance[] }> {
    return this.request(`/account-balances/${accountId}`);
  }

  async createBalance(data: CreateBalanceRequest): Promise<Balance> {
    return this.request('/balances', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateBalance(id: string, data: Partial<CreateBalanceRequest>): Promise<Balance> {
    return this.request(`/balances/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteBalance(id: string): Promise<{ success: boolean }> {
    return this.request(`/balances/${id}`, {
      method: 'DELETE',
    });
  }

  // Holding endpoints
  async getAccountHoldings(accountId: string): Promise<{ holdings: Holding[] }> {
    return this.request(`/account-holdings/${accountId}`);
  }

  async getHolding(id: string): Promise<Holding> {
    return this.request(`/holdings/${id}`);
  }

  async createHolding(data: CreateHoldingRequest): Promise<Holding> {
    return this.request('/holdings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateHolding(id: string, data: UpdateHoldingRequest): Promise<Holding> {
    return this.request(`/holdings/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteHolding(id: string): Promise<{ success: boolean }> {
    return this.request(`/holdings/${id}`, {
      method: 'DELETE',
    });
  }

  // Currency endpoints
  async getExchangeRates(): Promise<ExchangeRates> {
    return this.request('/currency/rates');
  }

  // Mortgage endpoints
  async createMortgageDetails(accountId: string, data: CreateMortgageDetailsRequest): Promise<MortgageDetails> {
    return this.request(`/accounts/${accountId}/mortgage`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getMortgageDetails(accountId: string): Promise<MortgageDetails> {
    return this.request(`/accounts/${accountId}/mortgage`);
  }

  async getAmortizationSchedule(accountId: string): Promise<{ schedule: AmortizationEntry[] }> {
    return this.request(`/accounts/${accountId}/mortgage/amortization`);
  }

  async recordMortgagePayment(accountId: string, data: CreateMortgagePaymentRequest): Promise<MortgagePayment> {
    return this.request(`/accounts/${accountId}/mortgage/payments`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getMortgagePayments(accountId: string): Promise<{ payments: MortgagePayment[] }> {
    return this.request(`/accounts/${accountId}/mortgage/payments`);
  }

  async syncMortgageBalance(accountId: string): Promise<void> {
    return this.request(`/accounts/${accountId}/mortgage/sync-balance`, {
      method: 'POST',
    });
  }

  // Loan endpoints
  async createLoanDetails(accountId: string, data: CreateLoanDetailsRequest): Promise<LoanDetails> {
    return this.request(`/accounts/${accountId}/loan`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getLoanDetails(accountId: string): Promise<LoanDetails> {
    return this.request(`/accounts/${accountId}/loan`);
  }

  async getLoanAmortizationSchedule(accountId: string): Promise<{ schedule: AmortizationEntry[] }> {
    return this.request(`/accounts/${accountId}/loan/amortization`);
  }

  async recordLoanPayment(accountId: string, data: CreateLoanPaymentRequest): Promise<LoanPayment> {
    return this.request(`/accounts/${accountId}/loan/payments`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getLoanPayments(accountId: string): Promise<{ payments: LoanPayment[] }> {
    return this.request(`/accounts/${accountId}/loan/payments`);
  }

  async syncLoanBalance(accountId: string): Promise<void> {
    return this.request(`/accounts/${accountId}/loan/sync-balance`, {
      method: 'POST',
    });
  }

  // Asset endpoints
  async createAssetDetails(accountId: string, data: CreateAssetDetailsRequest): Promise<AssetDetails> {
    return this.request(`/accounts/${accountId}/asset`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getAssetDetails(accountId: string): Promise<AssetDetails> {
    return this.request(`/accounts/${accountId}/asset`);
  }

  async updateAssetDetails(accountId: string, data: UpdateAssetDetailsRequest): Promise<AssetDetails> {
    return this.request(`/accounts/${accountId}/asset`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getAssetValuation(accountId: string): Promise<AssetWithCurrentValue> {
    return this.request(`/accounts/${accountId}/asset/valuation`);
  }

  async getAssetsSummary(): Promise<{ assets: AssetWithCurrentValue[] }> {
    return this.request('/assets/summary');
  }

  async recordDepreciation(accountId: string, data: CreateDepreciationEntryRequest): Promise<DepreciationEntry> {
    return this.request(`/accounts/${accountId}/asset/depreciation`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getDepreciationHistory(accountId: string): Promise<{ entries: DepreciationEntry[] }> {
    return this.request(`/accounts/${accountId}/asset/depreciation`);
  }

  async getDepreciationSchedule(accountId: string): Promise<{ schedule: DepreciationScheduleEntry[] }> {
    return this.request(`/accounts/${accountId}/asset/depreciation-schedule`);
  }

  async syncAssetBalance(accountId: string): Promise<void> {
    return this.request(`/accounts/${accountId}/asset/sync-balance`, {
      method: 'POST',
    });
  }

  // Projection endpoints
  async calculateProjection(data: CalculateProjectionRequest): Promise<ProjectionResponse> {
    return this.request('/projections/calculate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async createScenario(data: CreateScenarioRequest): Promise<ProjectionScenario> {
    return this.request('/projections/scenarios', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getScenarios(): Promise<{ scenarios: ProjectionScenario[] }> {
    return this.request('/projections/scenarios');
  }

  async getScenario(id: string): Promise<ProjectionScenario> {
    return this.request(`/projections/scenarios/${id}`);
  }

  async updateScenario(id: string, data: UpdateScenarioRequest): Promise<ProjectionScenario> {
    return this.request(`/projections/scenarios/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteScenario(id: string): Promise<{ success: boolean }> {
    return this.request(`/projections/scenarios/${id}`, {
      method: 'DELETE',
    });
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
