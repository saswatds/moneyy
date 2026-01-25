import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccounts } from '@/hooks/use-accounts';
import { useExchangeRates } from '@/hooks/use-exchange-rates';
import { IconPlus, IconLink } from '@tabler/icons-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function Accounts() {
  const navigate = useNavigate();
  const { data, isLoading } = useAccounts();
  const { data: exchangeRates } = useExchangeRates();
  const [selectedCurrency, setSelectedCurrency] = useState<string>('CAD');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const formatCurrencyAccounting = (amount: number, currency: string) => {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      signDisplay: 'never',
    }).format(Math.abs(amount));

    return amount < 0 ? `(${formatted})` : formatted;
  };

  const formatNumberOnly = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(amount));
  };

  const formatNumberWithSmallCents = (amount: number) => {
    const formatted = formatNumberOnly(amount);
    const [dollars, cents] = formatted.split('.');
    return (
      <>
        {dollars}
        <span className="text-xl">.{cents}</span>
      </>
    );
  };

  const getAccountTypeBadgeClass = (type: string) => {
    const normalizedType = type.toLowerCase();
    switch (normalizedType) {
      case 'checking':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
      case 'savings':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'investment':
      case 'brokerage':
      case 'tfsa':
      case 'rrsp':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400';
      case 'credit_card':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
      case 'loan':
      case 'mortgage':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  const formatAccountType = (type: string) => {
    return type.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const convertAmount = (amount: number, fromCurrency: string, toCurrency: string) => {
    if (!exchangeRates?.rates || fromCurrency === toCurrency) {
      return null;
    }
    const rate = exchangeRates.rates[fromCurrency]?.[toCurrency];
    if (!rate) return null;
    return amount * rate;
  };

  const calculateTotals = () => {
    if (!data?.accounts || !exchangeRates?.rates) {
      return { totalAssets: 0, totalLiabilities: 0, netWorth: 0 };
    }

    let totalAssets = 0;
    let totalLiabilities = 0;

    data.accounts.forEach((account) => {
      if (account.current_balance === undefined || account.current_balance === null) {
        return;
      }

      let balanceInSelectedCurrency = account.current_balance;

      // Convert to selected currency if different
      if (account.currency !== selectedCurrency) {
        const converted = convertAmount(account.current_balance, account.currency, selectedCurrency);
        if (converted !== null) {
          balanceInSelectedCurrency = converted;
        }
      }

      if (account.is_asset) {
        totalAssets += balanceInSelectedCurrency;
      } else {
        // Liabilities are already stored as negative, so add them
        totalLiabilities += balanceInSelectedCurrency;
      }
    });

    const netWorth = totalAssets + totalLiabilities; // liabilities are negative, so this is correct

    return { totalAssets, totalLiabilities, netWorth };
  };

  const formatBalance = (account: any) => {
    if (account.current_balance === undefined || account.current_balance === null) {
      return '-';
    }

    const isDebt = !account.is_asset;
    const balance = account.current_balance;

    if (account.currency === selectedCurrency) {
      return (
        <div className={isDebt && balance < 0 ? 'text-red-600 dark:text-red-400' : ''}>
          {formatCurrencyAccounting(balance, account.currency)}
        </div>
      );
    }

    const converted = convertAmount(balance, account.currency, selectedCurrency);
    if (converted === null) {
      return (
        <div className={isDebt && balance < 0 ? 'text-red-600 dark:text-red-400' : ''}>
          {formatCurrencyAccounting(balance, account.currency)}
        </div>
      );
    }

    return (
      <div>
        <div className={`font-medium ${isDebt && balance < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
          {formatCurrencyAccounting(converted, selectedCurrency)}
        </div>
        <div className={`text-xs text-muted-foreground ${isDebt && balance < 0 ? 'text-red-500/70 dark:text-red-400/70' : ''}`}>
          {formatCurrencyAccounting(balance, account.currency)}
        </div>
      </div>
    );
  };

  const filteredAccounts = data?.accounts.filter((account) => {
    if (filterType !== 'all' && account.type !== filterType) {
      return false;
    }
    if (filterCategory === 'asset' && !account.is_asset) {
      return false;
    }
    if (filterCategory === 'liability' && account.is_asset) {
      return false;
    }
    return true;
  }) || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const { totalAssets, totalLiabilities, netWorth } = calculateTotals();

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Accounts</h1>
          <p className="text-muted-foreground mt-2">
            Manage your financial accounts across all currencies
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">View in:</span>
            <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CAD">CAD</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="INR">INR</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => navigate('/accounts/new')} size="lg">
            <IconPlus className="h-5 w-5 mr-2" />
            New Account
          </Button>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Net Worth</CardDescription>
            <div className="mt-2">
              <div className={`text-3xl font-bold tabular-nums ${netWorth < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                {netWorth < 0 && '('}
                {formatNumberWithSmallCents(netWorth)}
                {netWorth < 0 && ')'}
              </div>
              <div className="text-sm text-muted-foreground mt-1">{selectedCurrency}</div>
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Liabilities</CardDescription>
            <div className="mt-2">
              <div className="text-3xl font-bold tabular-nums text-red-600 dark:text-red-400">
                {formatNumberWithSmallCents(totalLiabilities)}
              </div>
              <div className="text-sm text-muted-foreground mt-1">{selectedCurrency}</div>
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Assets</CardDescription>
            <div className="mt-2">
              <div className="text-3xl font-bold tabular-nums">
                {formatNumberWithSmallCents(totalAssets)}
              </div>
              <div className="text-sm text-muted-foreground mt-1">{selectedCurrency}</div>
            </div>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>
                {filterType !== 'all' || filterCategory !== 'all'
                  ? `Filtered Accounts (${filteredAccounts.length})`
                  : `All Accounts (${filteredAccounts.length})`}
              </CardTitle>
              <CardDescription className="mt-1.5">
                {filterType !== 'all' || filterCategory !== 'all'
                  ? 'Showing accounts matching selected filters'
                  : 'View and manage all your financial accounts'}
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Type:</span>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="checking">Checking</SelectItem>
                    <SelectItem value="savings">Savings</SelectItem>
                    <SelectItem value="tfsa">TFSA</SelectItem>
                    <SelectItem value="rrsp">RRSP</SelectItem>
                    <SelectItem value="brokerage">Brokerage</SelectItem>
                    <SelectItem value="crypto">Crypto</SelectItem>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                    <SelectItem value="loan">Loan</SelectItem>
                    <SelectItem value="mortgage">Mortgage</SelectItem>
                    <SelectItem value="real_estate">Real Estate</SelectItem>
                    <SelectItem value="vehicle">Vehicle</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Category:</span>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="asset">Assets</SelectItem>
                    <SelectItem value="liability">Liabilities</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Institution
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Type
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                    Current Balance
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Currency
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Category
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAccounts.length > 0 ? (
                  filteredAccounts.map((account) => (
                    <tr key={account.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-4">
                        <div className="text-sm text-muted-foreground">
                          {account.institution || '-'}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          {account.is_synced && (
                            <IconLink className="h-4 w-4 text-muted-foreground" />
                          )}
                          <div className="text-sm font-medium">{account.name}</div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${getAccountTypeBadgeClass(account.type)}`}>
                          {formatAccountType(account.type)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="text-sm">{formatBalance(account)}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm">{account.currency}</div>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded ${
                            account.is_asset
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                          }`}
                        >
                          {account.is_asset ? 'Asset' : 'Liability'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded ${
                            account.is_active
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                          }`}
                        >
                          {account.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/accounts/${account.id}`)}
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center">
                      <div className="text-muted-foreground">
                        {filterType !== 'all' || filterCategory !== 'all'
                          ? 'No accounts match the selected filters.'
                          : 'No accounts found. Create your first account to get started!'}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
