// API client for communicating with the backend
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

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
  balance_date?: string;
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

export interface SyncJob {
  id: string;
  synced_account_id: string;
  account_name?: string;
  type: 'accounts' | 'positions' | 'activities' | 'history' | 'full';
  status: 'pending' | 'running' | 'completed' | 'failed';
  started_at?: string;
  completed_at?: string;
  error_message?: string;
  items_processed: number;
  items_created: number;
  items_updated: number;
  items_failed: number;
  created_at: string;
}

export interface SyncSummary {
  total_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  running_jobs: number;
  pending_jobs: number;
  total_processed: number;
  total_created: number;
  total_updated: number;
  total_failed: number;
}

export interface SyncStatusResponse {
  connection_id: string;
  connection_name: string;
  status: 'connected' | 'disconnected' | 'error' | 'syncing';
  last_sync_at?: string;
  last_sync_error?: string;
  jobs: SyncJob[];
  summary: SyncSummary;
}

export interface SyncConnection {
  id: string;
  user_id: string;
  provider: string;
  name: string;
  email?: string;
  status: 'connected' | 'disconnected' | 'error' | 'syncing';
  last_sync_at?: string;
  last_sync_error?: string;
  token_expires_at?: string;
  sync_frequency: string;
  account_count: number;
  created_at: string;
  updated_at: string;
}

export interface WealthsimpleInitiateResponse {
  require_otp: boolean;
  credential_id?: string;
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

export type EventType =
  | 'one_time_income'
  | 'one_time_expense'
  | 'extra_debt_payment'
  | 'salary_change'
  | 'expense_level_change'
  | 'savings_rate_change';

export interface EventParameters {
  // One-time financial
  amount?: number;
  category?: string;
  account_id?: string;

  // Recurring changes
  new_salary?: number;
  new_salary_growth?: number;
  new_expenses?: number;
  expense_change?: number;
  expense_change_type?: 'absolute' | 'relative_amount' | 'relative_percent';
  new_expense_growth?: number;
  new_savings_rate?: number;
  reason?: string;
}

export type Event = {
  id: string;
  type: EventType;
  date: string;
  description: string;
  parameters: EventParameters;
  is_recurring?: boolean;
  recurrence_frequency?: 'monthly' | 'quarterly' | 'annually';
  recurrence_end_date?: string;
};

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
  asset_appreciation: Record<string, number>;
  savings_allocation: Record<string, number>;
  events: Event[];
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

export interface RecurringExpense {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  amount: number;
  currency: 'CAD' | 'USD' | 'INR';
  category: string;
  account_id?: string;
  frequency: 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly' | 'annually';
  day_of_month?: number;
  day_of_week?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateRecurringExpenseRequest {
  name: string;
  description?: string;
  amount: number;
  currency: 'CAD' | 'USD' | 'INR';
  category: string;
  account_id?: string;
  frequency: 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly' | 'annually';
  day_of_month?: number;
  day_of_week?: number;
}

export interface UpdateRecurringExpenseRequest {
  name?: string;
  description?: string;
  amount?: number;
  currency?: 'CAD' | 'USD' | 'INR';
  category?: string;
  account_id?: string;
  frequency?: 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly' | 'annually';
  day_of_month?: number;
  day_of_week?: number;
  is_active?: boolean;
}

export interface InferredExpense {
  account_id: string;
  account_name: string;
  type: 'mortgage' | 'loan';
  amount: number;
  currency: 'CAD' | 'USD' | 'INR';
  frequency: string;
  interest_rate: number;
  remaining_term?: number;
  original_amount: number;
}

// Stock Options Types
export type GrantType = 'iso' | 'nso' | 'rsu' | 'rsa';
export type VestingStatus = 'pending' | 'vested' | 'forfeited';
export type ExerciseMethod = 'cash' | 'cashless' | 'same_day_sale';

export interface EquityGrant {
  id: string;
  account_id: string;
  grant_type: GrantType;
  grant_date: string;
  quantity: number;
  strike_price?: number;
  fmv_at_grant: number;
  expiration_date?: string;
  company_name: string;
  currency: string;
  grant_number?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface EquityGrantWithSummary extends EquityGrant {
  vested_quantity: number;
  unvested_quantity: number;
  exercised_quantity: number;
  current_fmv?: number;
  vested_value: number;
  unvested_value: number;
  intrinsic_value: number;
}

export interface VestingSchedule {
  id: string;
  grant_id: string;
  schedule_type: 'time_based' | 'milestone';
  cliff_months?: number;
  total_vesting_months?: number;
  vesting_frequency?: 'monthly' | 'quarterly' | 'annually';
  milestone_description?: string;
  created_at: string;
}

export interface VestingEvent {
  id: string;
  grant_id: string;
  vest_date: string;
  quantity: number;
  fmv_at_vest: number;
  status: VestingStatus;
  notes?: string;
  created_at: string;
}

export interface EquityExercise {
  id: string;
  grant_id: string;
  exercise_date: string;
  quantity: number;
  strike_price: number;
  fmv_at_exercise: number;
  exercise_cost: number;
  taxable_benefit: number;
  exercise_method?: ExerciseMethod;
  notes?: string;
  created_at: string;
}

export interface EquitySale {
  id: string;
  account_id: string;
  grant_id?: string;
  exercise_id?: string;
  sale_date: string;
  quantity: number;
  sale_price: number;
  total_proceeds: number;
  cost_basis: number;
  capital_gain: number;
  holding_period_days?: number;
  is_qualified?: boolean;
  notes?: string;
  created_at: string;
}

export interface FMVEntry {
  id: string;
  account_id: string;
  currency: string;
  effective_date: string;
  fmv_per_share: number;
  notes?: string;
  created_at: string;
}

export interface CurrencySummary {
  currency: string;
  vested_value: number;
  unvested_value: number;
  total_intrinsic_value: number;
  current_fmv?: number;
  vested_shares: number;
  unvested_shares: number;
}

export interface OptionsSummary {
  total_grants: number;
  total_shares: number;
  vested_shares: number;
  unvested_shares: number;
  exercised_shares: number;
  sold_shares: number;
  current_fmv?: number;
  vested_value: number;
  unvested_value: number;
  total_intrinsic_value: number;
  by_grant_type: Record<string, number>;
  by_currency?: Record<string, CurrencySummary>;
  grants: EquityGrantWithSummary[];
}

export interface CurrencyTaxData {
  currency: string;
  total_taxable_benefit: number;
  total_capital_gains: number;
  stock_option_deduction: number;
  qualified_gains: number;
  non_qualified_gains: number;
  estimated_tax: number;
}

export interface TaxSummary {
  year: number;
  total_taxable_benefit: number;
  total_capital_gains: number;
  stock_option_deduction: number;
  qualified_gains: number;
  non_qualified_gains: number;
  estimated_tax: number;
  by_currency?: Record<string, CurrencyTaxData>;
}

export interface CreateEquityGrantRequest {
  account_id: string;
  grant_type: GrantType;
  grant_date: string;
  quantity: number;
  strike_price?: number;
  fmv_at_grant: number;
  expiration_date?: string;
  company_name: string;
  currency: string;
  grant_number?: string;
  notes?: string;
}

export interface UpdateEquityGrantRequest {
  grant_type?: GrantType;
  grant_date?: string;
  quantity?: number;
  strike_price?: number;
  fmv_at_grant?: number;
  expiration_date?: string;
  company_name?: string;
  currency?: string;
  grant_number?: string;
  notes?: string;
}

export interface SetVestingScheduleRequest {
  grant_id: string;
  schedule_type: 'time_based' | 'milestone';
  cliff_months?: number;
  total_vesting_months?: number;
  vesting_frequency?: 'monthly' | 'quarterly' | 'annually';
  milestone_description?: string;
}

export interface RecordExerciseRequest {
  grant_id: string;
  exercise_date: string;
  quantity: number;
  fmv_at_exercise: number;
  exercise_method?: ExerciseMethod;
  notes?: string;
}

export interface UpdateExerciseRequest {
  exercise_date?: string;
  quantity?: number;
  fmv_at_exercise?: number;
  exercise_method?: ExerciseMethod;
  notes?: string;
}

export interface RecordSaleRequest {
  account_id: string;
  grant_id?: string;
  exercise_id?: string;
  sale_date: string;
  quantity: number;
  sale_price: number;
  cost_basis: number;
  notes?: string;
}

export interface UpdateSaleRequest {
  sale_date?: string;
  quantity?: number;
  sale_price?: number;
  cost_basis?: number;
  notes?: string;
}

export interface RecordFMVRequest {
  account_id: string;
  currency: string;
  effective_date: string;
  fmv_per_share: number;
  notes?: string;
}

export interface UpdateVestingEventRequest {
  status?: VestingStatus;
  fmv_at_vest?: number;
  notes?: string;
}

// Income & Taxes Types
export type IncomeCategory = 'employment' | 'investment' | 'rental' | 'business' | 'other';
export type IncomeFrequency = 'one_time' | 'monthly' | 'bi-weekly' | 'annually';

export interface IncomeRecord {
  id: string;
  user_id: string;
  source: string;
  category: IncomeCategory;
  amount: number;
  currency: 'CAD' | 'USD' | 'INR';
  frequency: IncomeFrequency;
  tax_year: number;
  date_received?: string;
  description?: string;
  is_taxable: boolean;
  created_at: string;
  updated_at: string;
}

export interface IncomeTaxBracket {
  up_to_income: number;
  rate: number;
}

export type FieldSource = 'api' | 'manual';

export type FieldSources = Record<string, FieldSource>;

export interface TaxConfiguration {
  id?: string;
  user_id?: string;
  tax_year: number;
  province: string;
  federal_brackets: IncomeTaxBracket[];
  provincial_brackets: IncomeTaxBracket[];
  cpp_rate: number;
  cpp_max_pensionable_earnings: number;
  cpp_basic_exemption: number;
  ei_rate: number;
  ei_max_insurable_earnings: number;
  basic_personal_amount: number;
  field_sources?: FieldSources;
  created_at?: string;
  updated_at?: string;
}

export interface IncomeByCategory {
  employment: number;
  investment: number;
  rental: number;
  business: number;
  other: number;
}

export interface AnnualIncomeSummary {
  id?: string;
  user_id?: string;
  tax_year: number;
  total_gross_income: number;
  total_taxable_income: number;
  employment_income: number;
  investment_income: number;
  rental_income: number;
  business_income: number;
  other_income: number;
  stock_options_benefit: number;
  federal_tax: number;
  provincial_tax: number;
  cpp_contribution: number;
  ei_contribution: number;
  total_tax: number;
  net_income: number;
  effective_tax_rate: number;
  marginal_tax_rate: number;
  computed_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface YearSummary {
  year: number;
  total_gross_income: number;
  total_tax: number;
  net_income: number;
  effective_tax_rate: number;
  by_category: IncomeByCategory;
}

export interface YearComparisonResponse {
  years: YearSummary[];
}

export interface CreateIncomeRecordRequest {
  source: string;
  category: IncomeCategory;
  amount: number;
  currency: 'CAD' | 'USD' | 'INR';
  frequency: IncomeFrequency;
  tax_year: number;
  date_received?: string;
  description?: string;
  is_taxable?: boolean;
}

export interface UpdateIncomeRecordRequest {
  source?: string;
  category?: IncomeCategory;
  amount?: number;
  currency?: 'CAD' | 'USD' | 'INR';
  frequency?: IncomeFrequency;
  tax_year?: number;
  date_received?: string;
  description?: string;
  is_taxable?: boolean;
}

export interface SaveTaxConfigRequest {
  tax_year: number;
  province: string;
  federal_brackets: IncomeTaxBracket[];
  provincial_brackets: IncomeTaxBracket[];
  cpp_rate?: number;
  cpp_max_pensionable_earnings?: number;
  cpp_basic_exemption?: number;
  ei_rate?: number;
  ei_max_insurable_earnings?: number;
  basic_personal_amount?: number;
  field_sources?: FieldSources;
}

// Tax Simulator Types
export interface CalculateExerciseTaxRequest {
  quantity: number;
  strike_price: number;
  fmv_at_exercise: number;
  marginal_rate: number;
}

export interface ExerciseTaxResult {
  quantity: number;
  strike_price: number;
  fmv_at_exercise: number;
  exercise_cost: number;
  taxable_benefit: number;
  stock_option_deduction: number;
  net_taxable: number;
  estimated_tax: number;
}

export interface CalculateSaleTaxRequest {
  quantity: number;
  sale_price: number;
  cost_basis: number;
  acquisition_date: string;
  sale_date: string;
  marginal_rate: number;
}

export interface SaleTaxResult {
  quantity: number;
  sale_price: number;
  cost_basis: number;
  total_proceeds: number;
  capital_gain: number;
  holding_period_days: number;
  taxable_gain: number;
  estimated_tax: number;
}

export interface BatchTaxCalculationRequest {
  exercises: CalculateExerciseTaxRequest[];
  sales: CalculateSaleTaxRequest[];
  marginal_rate: number;
}

export interface BatchTaxCalculationResult {
  exercises: ExerciseTaxResult[];
  sales: SaleTaxResult[];
  total_exercise_tax: number;
  total_sale_tax: number;
  total_tax: number;
}

// API Keys Types
export interface APIKeyStatus {
  provider: string;
  is_configured: boolean;
  name?: string;
  last_used_at?: string;
  is_active?: boolean;
}

export interface SaveAPIKeyRequest {
  provider: string;
  api_key: string;
  name?: string;
}

export interface TransformedTaxBrackets {
  country: string;
  year: number;
  region: string;
  federal_brackets: IncomeTaxBracket[];
  provincial_brackets: IncomeTaxBracket[];
}

export interface TransformedTaxParams {
  country: string;
  year: number;
  region: string;
  cpp_rate: number;
  cpp_max_pensionable_earnings: number;
  cpp_basic_exemption: number;
  ei_rate: number;
  ei_max_insurable_earnings: number;
  basic_personal_amount: number;
  rrsp_limit: number;
  tfsa_limit: number;
}

class ApiClient {
  private baseUrl: string;
  private getToken: () => string | null = () => localStorage.getItem('auth_token');

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options?.headers as Record<string, string>),
    };

    // Add Authorization header if token exists
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Add demo mode header if enabled
    if (localStorage.getItem('demo_mode') === 'true') {
      headers['X-Demo-Mode'] = 'true';
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      // If unauthorized, clear token and redirect to login
      if (response.status === 401) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        window.location.href = '/login';
      }
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

  // Recurring Expenses
  async getRecurringExpenses(): Promise<{ expenses: RecurringExpense[]; inferred_expenses: InferredExpense[] }> {
    return this.request('/recurring-expenses');
  }

  async getRecurringExpense(id: string): Promise<RecurringExpense> {
    return this.request(`/recurring-expenses/${id}`);
  }

  async createRecurringExpense(data: CreateRecurringExpenseRequest): Promise<RecurringExpense> {
    return this.request('/recurring-expenses', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateRecurringExpense(id: string, data: UpdateRecurringExpenseRequest): Promise<RecurringExpense> {
    return this.request(`/recurring-expenses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteRecurringExpense(id: string): Promise<void> {
    return this.request(`/recurring-expenses/${id}`, {
      method: 'DELETE',
    });
  }

  // Sync endpoints
  async getSyncConnections(): Promise<{ connections: SyncConnection[] }> {
    return this.request('/sync/connections');
  }

  async checkWealthsimpleCredentials(): Promise<{ has_credentials: boolean; email: string }> {
    return this.request('/sync/wealthsimple/check-credentials');
  }

  async initiateWealthsimpleConnection(username: string, password: string): Promise<WealthsimpleInitiateResponse> {
    return this.request('/sync/wealthsimple/initiate', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  }

  async verifyWealthsimpleOTP(credentialId: string, otpCode: string): Promise<void> {
    return this.request('/sync/wealthsimple/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ credential_id: credentialId, otp_code: otpCode }),
    });
  }

  async syncConnection(connectionId: string): Promise<void> {
    return this.request(`/sync/connections/${connectionId}/sync`, {
      method: 'POST',
    });
  }

  async getSyncStatus(connectionId: string): Promise<SyncStatusResponse> {
    return this.request(`/sync/connections/${connectionId}/status`);
  }

  async updateConnection(connectionId: string, data: { sync_frequency: string }): Promise<void> {
    return this.request(`/sync/connections/${connectionId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteConnection(connectionId: string): Promise<void> {
    return this.request(`/sync/connections/${connectionId}`, {
      method: 'DELETE',
    });
  }

  // Data export/import endpoints
  async exportData(): Promise<Blob> {
    const token = this.getToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}/data/export`, {
      method: 'POST',
      headers,
    });
    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        window.location.href = '/login';
      }
      throw new Error(`Export failed: ${response.statusText}`);
    }
    return response.blob();
  }

  async importData(file: File, mode: string = 'merge'): Promise<any> {
    const token = this.getToken();
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mode', mode);

    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}/data/import`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        window.location.href = '/login';
        throw new Error('Session expired. Please log in again.');
      }
      const errorText = await response.text();
      let errorMessage = `Import failed: ${response.statusText}`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.message) {
          errorMessage = errorJson.message;
        }
      } catch {
        // If not JSON, use the text as is
        if (errorText) {
          errorMessage = errorText;
        }
      }
      throw new Error(errorMessage);
    }

    return response.json();
  }

  // Demo mode endpoints
  async seedDemoData(): Promise<{ success: boolean; message: string }> {
    return this.request('/demo/seed', {
      method: 'POST',
    });
  }

  async resetDemoData(): Promise<{ success: boolean; message: string }> {
    return this.request('/demo/reset', {
      method: 'POST',
    });
  }

  async getDemoStatus(): Promise<{ has_data: boolean }> {
    return this.request('/demo/status');
  }

  // Stock Options endpoints

  // Grants
  async createEquityGrant(accountId: string, data: CreateEquityGrantRequest): Promise<EquityGrant> {
    return this.request(`/accounts/${accountId}/options/grants`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getEquityGrants(accountId: string): Promise<{ grants: EquityGrant[] }> {
    return this.request(`/accounts/${accountId}/options/grants`);
  }

  async getEquityGrant(accountId: string, grantId: string): Promise<EquityGrant> {
    return this.request(`/accounts/${accountId}/options/grants/${grantId}`);
  }

  async updateEquityGrant(accountId: string, grantId: string, data: UpdateEquityGrantRequest): Promise<EquityGrant> {
    return this.request(`/accounts/${accountId}/options/grants/${grantId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteEquityGrant(accountId: string, grantId: string): Promise<{ success: boolean }> {
    return this.request(`/accounts/${accountId}/options/grants/${grantId}`, {
      method: 'DELETE',
    });
  }

  // Vesting Schedule
  async setVestingSchedule(accountId: string, grantId: string, data: SetVestingScheduleRequest): Promise<VestingSchedule> {
    return this.request(`/accounts/${accountId}/options/grants/${grantId}/vesting-schedule`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getVestingSchedule(accountId: string, grantId: string): Promise<VestingSchedule> {
    return this.request(`/accounts/${accountId}/options/grants/${grantId}/vesting-schedule`);
  }

  async generateVestingEvents(accountId: string, grantId: string): Promise<{ events: VestingEvent[] }> {
    return this.request(`/accounts/${accountId}/options/grants/${grantId}/vesting-events/generate`, {
      method: 'POST',
    });
  }

  async getVestingEvents(accountId: string, grantId: string): Promise<{ events: VestingEvent[] }> {
    return this.request(`/accounts/${accountId}/options/grants/${grantId}/vesting-events`);
  }

  async updateVestingEvent(accountId: string, eventId: string, data: UpdateVestingEventRequest): Promise<VestingEvent> {
    return this.request(`/accounts/${accountId}/options/vesting-events/${eventId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Exercises
  async recordExercise(accountId: string, grantId: string, data: RecordExerciseRequest): Promise<EquityExercise> {
    return this.request(`/accounts/${accountId}/options/grants/${grantId}/exercises`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getExercises(accountId: string, grantId: string): Promise<{ exercises: EquityExercise[] }> {
    return this.request(`/accounts/${accountId}/options/grants/${grantId}/exercises`);
  }

  async getAllExercises(accountId: string): Promise<{ exercises: EquityExercise[] }> {
    return this.request(`/accounts/${accountId}/options/exercises`);
  }

  async updateExercise(accountId: string, exerciseId: string, data: UpdateExerciseRequest): Promise<EquityExercise> {
    return this.request(`/accounts/${accountId}/options/exercises/${exerciseId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteExercise(accountId: string, exerciseId: string): Promise<void> {
    return this.request(`/accounts/${accountId}/options/exercises/${exerciseId}`, {
      method: 'DELETE',
    });
  }

  // Sales
  async recordSale(accountId: string, data: RecordSaleRequest): Promise<EquitySale> {
    return this.request(`/accounts/${accountId}/options/sales`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getSales(accountId: string): Promise<{ sales: EquitySale[] }> {
    return this.request(`/accounts/${accountId}/options/sales`);
  }

  async updateSale(accountId: string, saleId: string, data: UpdateSaleRequest): Promise<EquitySale> {
    return this.request(`/accounts/${accountId}/options/sales/${saleId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteSale(accountId: string, saleId: string): Promise<void> {
    return this.request(`/accounts/${accountId}/options/sales/${saleId}`, {
      method: 'DELETE',
    });
  }

  // FMV
  async recordFMV(accountId: string, data: RecordFMVRequest): Promise<FMVEntry> {
    return this.request(`/accounts/${accountId}/options/fmv`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getFMVHistory(accountId: string): Promise<{ entries: FMVEntry[] }> {
    return this.request(`/accounts/${accountId}/options/fmv`);
  }

  async getCurrentFMV(accountId: string): Promise<FMVEntry | null> {
    return this.request(`/accounts/${accountId}/options/fmv/current`);
  }

  // Summary
  async getOptionsSummary(accountId: string): Promise<OptionsSummary> {
    return this.request(`/accounts/${accountId}/options/summary`);
  }

  async getTaxSummary(accountId: string, year?: number): Promise<TaxSummary> {
    const yearParam = year ? `?year=${year}` : '';
    return this.request(`/accounts/${accountId}/options/tax-summary${yearParam}`);
  }

  async getUpcomingVestingEvents(accountId: string, days?: number): Promise<{ events: VestingEvent[] }> {
    const daysParam = days ? `?days=${days}` : '';
    return this.request(`/accounts/${accountId}/options/vesting-timeline${daysParam}`);
  }

  // Income & Taxes endpoints

  async getIncomeRecords(year?: number, category?: IncomeCategory): Promise<{ records: IncomeRecord[] }> {
    const params = new URLSearchParams();
    if (year) params.append('year', year.toString());
    if (category) params.append('category', category);
    const queryString = params.toString();
    return this.request(`/income${queryString ? `?${queryString}` : ''}`);
  }

  async getIncomeRecord(id: string): Promise<IncomeRecord> {
    return this.request(`/income/${id}`);
  }

  async createIncomeRecord(data: CreateIncomeRecordRequest): Promise<IncomeRecord> {
    return this.request('/income', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateIncomeRecord(id: string, data: UpdateIncomeRecordRequest): Promise<IncomeRecord> {
    return this.request(`/income/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteIncomeRecord(id: string): Promise<{ success: boolean }> {
    return this.request(`/income/${id}`, {
      method: 'DELETE',
    });
  }

  async getAnnualIncomeSummary(year: number): Promise<AnnualIncomeSummary> {
    return this.request(`/income/summary/${year}`);
  }

  async getIncomeComparison(startYear: number, endYear: number): Promise<YearComparisonResponse> {
    return this.request(`/income/comparison?start=${startYear}&end=${endYear}`);
  }

  async getIncomeTaxConfig(year: number): Promise<TaxConfiguration> {
    return this.request(`/income/tax-config/${year}`);
  }

  async saveIncomeTaxConfig(data: SaveTaxConfigRequest): Promise<TaxConfiguration> {
    return this.request('/income/tax-config', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Tax Simulator endpoints

  async calculateExerciseTax(data: CalculateExerciseTaxRequest): Promise<ExerciseTaxResult> {
    return this.request('/income/tax-simulator/exercise', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async calculateSaleTax(data: CalculateSaleTaxRequest): Promise<SaleTaxResult> {
    return this.request('/income/tax-simulator/sale', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async calculateBatchTax(data: BatchTaxCalculationRequest): Promise<BatchTaxCalculationResult> {
    return this.request('/income/tax-simulator/batch', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // API Keys endpoints

  async getAPIKeyStatus(provider: string): Promise<APIKeyStatus> {
    return this.request(`/api-keys/status/${provider}`);
  }

  async saveAPIKey(data: SaveAPIKeyRequest): Promise<APIKeyStatus> {
    return this.request('/api-keys', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteAPIKey(provider: string): Promise<{ success: boolean }> {
    return this.request(`/api-keys/${provider}`, {
      method: 'DELETE',
    });
  }

  // Moneyy API endpoints

  async fetchTaxBracketsFromAPI(country: string, year: number, region: string): Promise<TransformedTaxBrackets> {
    return this.request(`/moneyy/tax-brackets/${country}/${year}/${region}`);
  }

  async fetchTaxParamsFromAPI(country: string, year: number, region: string): Promise<TransformedTaxParams> {
    return this.request(`/moneyy/tax-params/${country}/${year}/${region}`);
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
