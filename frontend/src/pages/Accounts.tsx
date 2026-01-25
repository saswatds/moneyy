import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccounts } from '@/hooks/use-accounts';
import { useExchangeRates } from '@/hooks/use-exchange-rates';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Account } from '@/lib/api-client';
import { IconPlus, IconLink, IconEdit, IconTrash, IconAlertTriangle } from '@tabler/icons-react';
import { getAccountTypeBadgeColor, getAccountTypeLabel } from '@/lib/account-types';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function Accounts() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading } = useAccounts();
  const { data: exchangeRates } = useExchangeRates();
  const [selectedCurrency, setSelectedCurrency] = useState<string>('CAD');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [editForm, setEditForm] = useState({ name: '', institution: '' });
  const [deleteAccount, setDeleteAccount] = useState<Account | null>(null);

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


  const isBalanceStale = (balanceDate?: string): boolean => {
    if (!balanceDate) return false;
    const date = new Date(balanceDate);
    const now = new Date();
    const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    return date < oneMonthAgo;
  };

  const getBalanceAge = (balanceDate?: string): string => {
    if (!balanceDate) return '';
    const date = new Date(balanceDate);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 30) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    } else {
      const months = Math.floor(diffDays / 30);
      return `${months} month${months !== 1 ? 's' : ''} ago`;
    }
  };

  const convertAmount = (amount: number, fromCurrency: string, toCurrency: string) => {
    if (!exchangeRates?.rates || fromCurrency === toCurrency) {
      return null;
    }
    const rate = exchangeRates.rates[fromCurrency]?.[toCurrency];
    if (!rate) return null;
    return amount * rate;
  };

  // Update account mutation
  const updateMutation = useMutation({
    mutationFn: (data: { id: string; name: string; institution: string }) =>
      apiClient.updateAccount(data.id, { name: data.name, institution: data.institution }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setEditingAccount(null);
    },
  });

  // Delete account mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteAccount(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setDeleteAccount(null);
    },
  });

  const handleEdit = (account: Account) => {
    setEditingAccount(account);
    setEditForm({ name: account.name, institution: account.institution || '' });
  };

  const handleSaveEdit = () => {
    if (editingAccount) {
      updateMutation.mutate({
        id: editingAccount.id,
        name: editForm.name,
        institution: editForm.institution,
      });
    }
  };

  const handleDelete = (account: Account) => {
    setDeleteAccount(account);
  };

  const confirmDelete = () => {
    if (deleteAccount) {
      deleteMutation.mutate(deleteAccount.id);
    }
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
                          <div>
                            <div className="text-sm font-medium flex items-center gap-2">
                              {account.name}
                              {isBalanceStale(account.balance_date) && (
                                <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400" title={`Balance is ${getBalanceAge(account.balance_date)} old`}>
                                  <IconAlertTriangle className="h-4 w-4" />
                                  <span className="text-xs">Stale</span>
                                </div>
                              )}
                            </div>
                            {account.balance_date && isBalanceStale(account.balance_date) && (
                              <div className="text-xs text-muted-foreground mt-0.5">
                                Last updated: {getBalanceAge(account.balance_date)}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${getAccountTypeBadgeColor(account.type)}`}>
                          {getAccountTypeLabel(account.type)}
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
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/accounts/${account.id}`)}
                          >
                            View
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(account);
                            }}
                          >
                            <IconEdit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(account);
                            }}
                            className="text-destructive hover:text-destructive"
                          >
                            <IconTrash className="h-4 w-4" />
                          </Button>
                        </div>
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

      {/* Edit Account Dialog */}
      <Dialog open={!!editingAccount} onOpenChange={(open) => !open && setEditingAccount(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Account</DialogTitle>
            <DialogDescription>
              Update account details. Account type and currency cannot be changed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Account Name</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="My Account"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-institution">Institution</Label>
              <Input
                id="edit-institution"
                value={editForm.institution}
                onChange={(e) => setEditForm({ ...editForm, institution: e.target.value })}
                placeholder="Bank Name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingAccount(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateMutation.isPending || !editForm.name}>
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteAccount} onOpenChange={(open) => !open && setDeleteAccount(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteAccount?.name}"? This action cannot be undone.
              All associated data including balances, transactions, and holdings will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Account'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
