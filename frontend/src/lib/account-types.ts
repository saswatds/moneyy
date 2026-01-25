// Account type configuration framework
// Defines UI behavior and features for each account type

export interface AccountTypeConfig {
  type: string;
  label: string;
  description: string;
  isAsset: boolean;

  features: {
    // Core features
    hasBalances: boolean;
    hasHoldings: boolean;
    hasMortgage: boolean;
    hasLoan: boolean;
    hasAsset: boolean;
    hasTransactions: boolean;
  };

  ui: {
    // Detail page sections
    showBalanceChart: boolean;
    showBalanceForm: boolean;
    showHoldingForm: boolean;
    showBalanceHistory: boolean;
    showHoldingsHistory: boolean;

    // Special behaviors
    redirectToSpecialPage?: (accountId: string) => string;
    requiresSetup?: boolean;
  };

  // Visual styling
  badgeColor: string;
}

export const ACCOUNT_TYPE_CONFIGS: Record<string, AccountTypeConfig> = {
  // Cash & Banking Accounts
  checking: {
    type: 'checking',
    label: 'Checking Account',
    description: 'Day-to-day spending account',
    isAsset: true,
    features: {
      hasBalances: true,
      hasHoldings: false,
      hasMortgage: false,
      hasLoan: false,
      hasAsset: false,
      hasTransactions: true,
    },
    ui: {
      showBalanceChart: true,
      showBalanceForm: true,
      showHoldingForm: false,
      showBalanceHistory: true,
      showHoldingsHistory: false,
    },
    badgeColor: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  },

  savings: {
    type: 'savings',
    label: 'Savings Account',
    description: 'Interest-bearing savings account',
    isAsset: true,
    features: {
      hasBalances: true,
      hasHoldings: false,
      hasMortgage: false,
      hasLoan: false,
      hasAsset: false,
      hasTransactions: true,
    },
    ui: {
      showBalanceChart: true,
      showBalanceForm: true,
      showHoldingForm: false,
      showBalanceHistory: true,
      showHoldingsHistory: false,
    },
    badgeColor: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  },

  cash: {
    type: 'cash',
    label: 'Cash',
    description: 'Physical cash holdings',
    isAsset: true,
    features: {
      hasBalances: true,
      hasHoldings: false,
      hasMortgage: false,
      hasLoan: false,
      hasAsset: false,
      hasTransactions: false,
    },
    ui: {
      showBalanceChart: true,
      showBalanceForm: true,
      showHoldingForm: false,
      showBalanceHistory: true,
      showHoldingsHistory: false,
    },
    badgeColor: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  },

  // Investment Accounts
  brokerage: {
    type: 'brokerage',
    label: 'Brokerage Account',
    description: 'Taxable investment account',
    isAsset: true,
    features: {
      hasBalances: true,
      hasHoldings: true,
      hasMortgage: false,
      hasLoan: false,
      hasAsset: false,
      hasTransactions: true,
    },
    ui: {
      showBalanceChart: true,
      showBalanceForm: true,
      showHoldingForm: true,
      showBalanceHistory: true,
      showHoldingsHistory: true,
    },
    badgeColor: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
  },

  tfsa: {
    type: 'tfsa',
    label: 'TFSA',
    description: 'Tax-Free Savings Account',
    isAsset: true,
    features: {
      hasBalances: true,
      hasHoldings: true,
      hasMortgage: false,
      hasLoan: false,
      hasAsset: false,
      hasTransactions: true,
    },
    ui: {
      showBalanceChart: true,
      showBalanceForm: true,
      showHoldingForm: true,
      showBalanceHistory: true,
      showHoldingsHistory: true,
    },
    badgeColor: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
  },

  rrsp: {
    type: 'rrsp',
    label: 'RRSP',
    description: 'Registered Retirement Savings Plan',
    isAsset: true,
    features: {
      hasBalances: true,
      hasHoldings: true,
      hasMortgage: false,
      hasLoan: false,
      hasAsset: false,
      hasTransactions: true,
    },
    ui: {
      showBalanceChart: true,
      showBalanceForm: true,
      showHoldingForm: true,
      showBalanceHistory: true,
      showHoldingsHistory: true,
    },
    badgeColor: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
  },

  crypto: {
    type: 'crypto',
    label: 'Cryptocurrency',
    description: 'Digital currency holdings',
    isAsset: true,
    features: {
      hasBalances: true,
      hasHoldings: true,
      hasMortgage: false,
      hasLoan: false,
      hasAsset: false,
      hasTransactions: true,
    },
    ui: {
      showBalanceChart: true,
      showBalanceForm: true,
      showHoldingForm: true,
      showBalanceHistory: true,
      showHoldingsHistory: true,
    },
    badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  },

  // Debt Accounts
  credit_card: {
    type: 'credit_card',
    label: 'Credit Card',
    description: 'Revolving credit account',
    isAsset: false,
    features: {
      hasBalances: true,
      hasHoldings: false,
      hasMortgage: false,
      hasLoan: false,
      hasAsset: false,
      hasTransactions: true,
    },
    ui: {
      showBalanceChart: true,
      showBalanceForm: true,
      showHoldingForm: false,
      showBalanceHistory: true,
      showHoldingsHistory: false,
    },
    badgeColor: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  },

  loan: {
    type: 'loan',
    label: 'Loan',
    description: 'Personal or auto loan',
    isAsset: false,
    features: {
      hasBalances: false,
      hasHoldings: false,
      hasMortgage: false,
      hasLoan: true,
      hasAsset: false,
      hasTransactions: false,
    },
    ui: {
      showBalanceChart: false,
      showBalanceForm: false,
      showHoldingForm: false,
      showBalanceHistory: false,
      showHoldingsHistory: false,
      redirectToSpecialPage: (accountId) => `/accounts/${accountId}/loan`,
      requiresSetup: true,
    },
    badgeColor: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  },

  mortgage: {
    type: 'mortgage',
    label: 'Mortgage',
    description: 'Home loan',
    isAsset: false,
    features: {
      hasBalances: false,
      hasHoldings: false,
      hasMortgage: true,
      hasLoan: false,
      hasAsset: false,
      hasTransactions: false,
    },
    ui: {
      showBalanceChart: false,
      showBalanceForm: false,
      showHoldingForm: false,
      showBalanceHistory: false,
      showHoldingsHistory: false,
      redirectToSpecialPage: (accountId) => `/accounts/${accountId}/mortgage`,
      requiresSetup: true,
    },
    badgeColor: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  },

  line_of_credit: {
    type: 'line_of_credit',
    label: 'Line of Credit',
    description: 'Revolving credit line',
    isAsset: false,
    features: {
      hasBalances: true,
      hasHoldings: false,
      hasMortgage: false,
      hasLoan: false,
      hasAsset: false,
      hasTransactions: true,
    },
    ui: {
      showBalanceChart: true,
      showBalanceForm: true,
      showHoldingForm: false,
      showBalanceHistory: true,
      showHoldingsHistory: false,
    },
    badgeColor: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  },

  // Physical Assets
  real_estate: {
    type: 'real_estate',
    label: 'Real Estate',
    description: 'Property and land',
    isAsset: true,
    features: {
      hasBalances: false,
      hasHoldings: false,
      hasMortgage: false,
      hasLoan: false,
      hasAsset: true,
      hasTransactions: false,
    },
    ui: {
      showBalanceChart: false,
      showBalanceForm: false,
      showHoldingForm: false,
      showBalanceHistory: false,
      showHoldingsHistory: false,
      redirectToSpecialPage: (accountId) => `/accounts/${accountId}/asset`,
      requiresSetup: true,
    },
    badgeColor: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  },

  vehicle: {
    type: 'vehicle',
    label: 'Vehicle',
    description: 'Cars, boats, etc.',
    isAsset: true,
    features: {
      hasBalances: false,
      hasHoldings: false,
      hasMortgage: false,
      hasLoan: false,
      hasAsset: true,
      hasTransactions: false,
    },
    ui: {
      showBalanceChart: false,
      showBalanceForm: false,
      showHoldingForm: false,
      showBalanceHistory: false,
      showHoldingsHistory: false,
      redirectToSpecialPage: (accountId) => `/accounts/${accountId}/asset`,
      requiresSetup: true,
    },
    badgeColor: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  },

  collectible: {
    type: 'collectible',
    label: 'Collectible',
    description: 'Art, antiques, valuables',
    isAsset: true,
    features: {
      hasBalances: false,
      hasHoldings: false,
      hasMortgage: false,
      hasLoan: false,
      hasAsset: true,
      hasTransactions: false,
    },
    ui: {
      showBalanceChart: false,
      showBalanceForm: false,
      showHoldingForm: false,
      showBalanceHistory: false,
      showHoldingsHistory: false,
      redirectToSpecialPage: (accountId) => `/accounts/${accountId}/asset`,
      requiresSetup: true,
    },
    badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  },

  other: {
    type: 'other',
    label: 'Other',
    description: 'Other account types',
    isAsset: true,
    features: {
      hasBalances: true,
      hasHoldings: false,
      hasMortgage: false,
      hasLoan: false,
      hasAsset: false,
      hasTransactions: false,
    },
    ui: {
      showBalanceChart: true,
      showBalanceForm: true,
      showHoldingForm: false,
      showBalanceHistory: true,
      showHoldingsHistory: false,
    },
    badgeColor: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  },
};

// Helper functions
export function getAccountTypeConfig(type: string): AccountTypeConfig {
  return ACCOUNT_TYPE_CONFIGS[type] || ACCOUNT_TYPE_CONFIGS.other;
}

export function getAccountTypeLabel(type: string): string {
  return getAccountTypeConfig(type).label;
}

export function getAccountTypeBadgeColor(type: string): string {
  return getAccountTypeConfig(type).badgeColor;
}

export function shouldShowHoldings(type: string): boolean {
  return getAccountTypeConfig(type).features.hasHoldings;
}

export function shouldShowBalances(type: string): boolean {
  return getAccountTypeConfig(type).features.hasBalances;
}

export function getAccountTypeRedirect(type: string, accountId: string): string | undefined {
  const config = getAccountTypeConfig(type);
  return config.ui.redirectToSpecialPage?.(accountId);
}

export function formatAccountType(type: string): string {
  return type.split('_').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
}

// Get all account types for dropdowns/filters
export function getAllAccountTypes(): AccountTypeConfig[] {
  return Object.values(ACCOUNT_TYPE_CONFIGS);
}

export function getAccountTypesByCategory(category: 'asset' | 'liability'): AccountTypeConfig[] {
  return getAllAccountTypes().filter(config =>
    category === 'asset' ? config.isAsset : !config.isAsset
  );
}
