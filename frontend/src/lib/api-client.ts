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
}

export const apiClient = new ApiClient(API_BASE_URL);
