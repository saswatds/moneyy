import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
import { IconLink, IconBuilding, IconRefresh, IconTrash, IconPlus, IconBrandStripe, IconBrandPaypal, IconEdit, IconDownload, IconUpload, IconAlertCircle, IconLoader2, IconHistory } from '@tabler/icons-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { WealthsimpleConnectDialog } from '@/components/sync/WealthsimpleConnectDialog';
import { useRef } from 'react';
import { apiClient } from '@/lib/api-client';

interface Connection {
  id: string;
  user_id: string;
  provider: string;
  name: string;
  status: 'connected' | 'disconnected' | 'error' | 'syncing';
  last_sync_at?: string;
  last_sync_error?: string;
  sync_frequency: string;
  account_count: number;
  created_at: string;
  updated_at: string;
}

interface Provider {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  status: 'available' | 'coming_soon' | 'beta';
  color: string;
}

const AVAILABLE_PROVIDERS: Provider[] = [
  {
    id: 'wealthsimple',
    name: 'Wealthsimple',
    description: 'Connect your Wealthsimple investing and trading accounts',
    icon: IconBuilding,
    status: 'available',
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  },
  {
    id: 'plaid',
    name: 'Plaid',
    description: 'Connect thousands of banks and financial institutions',
    icon: IconLink,
    status: 'coming_soon',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  },
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Sync business transactions and payments',
    icon: IconBrandStripe,
    status: 'coming_soon',
    color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
  },
  {
    id: 'paypal',
    name: 'PayPal',
    description: 'Import PayPal balance and transactions',
    icon: IconBrandPaypal,
    status: 'coming_soon',
    color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
  },
];

export function Settings() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [editFrequency, setEditFrequency] = useState<string>('');
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [wealthsimpleCredentials, setWealthsimpleCredentials] = useState({ hasCredentials: false, email: '' });
  const [reconnecting, setReconnecting] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [syncingConnectionId, setSyncingConnectionId] = useState<string | null>(null);
  const [reconnectingConnectionId, setReconnectingConnectionId] = useState<string | null>(null);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyConnection, setHistoryConnection] = useState<Connection | null>(null);
  const [syncHistory, setSyncHistory] = useState<any | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const syncStatusIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    fetchConnections();
    checkWealthsimpleCredentials();
  }, []);

  const fetchConnections = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getSyncConnections();
      setConnections(data.connections || []);
    } catch (error) {
      console.error('Failed to fetch connections:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkWealthsimpleCredentials = async () => {
    try {
      const data = await apiClient.checkWealthsimpleCredentials();
      setWealthsimpleCredentials({
        hasCredentials: data.has_credentials,
        email: data.email || '',
      });
    } catch (error) {
      console.error('Failed to check credentials:', error);
    }
  };

  const handleConnectProvider = (providerId: string) => {
    const provider = AVAILABLE_PROVIDERS.find(p => p.id === providerId);
    if (!provider || provider.status !== 'available') return;

    setSelectedProvider(providerId);
    if (providerId === 'wealthsimple') {
      setShowConnectDialog(true);
    }
  };

  const handleReconnect = async () => {
    try {
      setReconnecting(true);
      const data = await apiClient.reconnectWealthsimple();

      if (data.connection_id) {
        await fetchConnections();
      }
    } catch (error) {
      console.error('Failed to reconnect:', error);
    } finally {
      setReconnecting(false);
    }
  };

  const handleReconnectConnection = async (connectionId: string) => {
    try {
      setReconnectingConnectionId(connectionId);
      // For now, use the general reconnect which updates the existing connection
      const data = await apiClient.reconnectWealthsimple();

      if (data.connection_id) {
        await fetchConnections();
      }
    } catch (error: any) {
      console.error('Failed to reconnect:', error);
    } finally {
      setReconnectingConnectionId(null);
    }
  };

  const handleViewHistory = async (connection: Connection) => {
    setHistoryConnection(connection);
    setHistoryDialogOpen(true);
    setLoadingHistory(true);

    try {
      const status = await apiClient.getSyncStatus(connection.id);
      setSyncHistory(status);
    } catch (error) {
      console.error('Failed to load sync history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Cleanup polling when modal closes
  const handleCloseHistoryModal = () => {
    setHistoryDialogOpen(false);
    if (syncStatusIntervalRef.current) {
      clearInterval(syncStatusIntervalRef.current);
      syncStatusIntervalRef.current = null;
    }
  };

  const pollSyncStatus = async (connectionId: string) => {
    try {
      const status = await apiClient.getSyncStatus(connectionId);
      setSyncHistory(status);

      // Stop polling if sync is complete
      if (status.status !== 'syncing' && status.summary.running_jobs === 0 && status.summary.pending_jobs === 0) {
        if (syncStatusIntervalRef.current) {
          clearInterval(syncStatusIntervalRef.current);
          syncStatusIntervalRef.current = null;
        }
        setSyncingConnectionId(null);
        // Refresh connections to update last sync time
        fetchConnections();
      }
    } catch (error: any) {
      console.error('Failed to fetch sync status:', error);
    }
  };

  const handleSync = async (connectionId: string) => {
    const connection = connections.find(c => c.id === connectionId);
    if (!connection) return;

    // Open the history modal and set the connection
    setHistoryConnection(connection);
    setHistoryDialogOpen(true);
    setLoadingHistory(true);
    setSyncingConnectionId(connectionId);
    setSyncHistory(null);

    try {
      await apiClient.syncConnection(connectionId);

      // Initial status load
      const status = await apiClient.getSyncStatus(connectionId);
      setSyncHistory(status);
      setLoadingHistory(false);

      // Start polling for status updates
      pollSyncStatus(connectionId);
      syncStatusIntervalRef.current = setInterval(() => {
        pollSyncStatus(connectionId);
      }, 2000); // Poll every 2 seconds
    } catch (error: any) {
      console.error('Failed to sync:', error);
      setSyncingConnectionId(null);
      setLoadingHistory(false);
    }
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (syncStatusIntervalRef.current) {
        clearInterval(syncStatusIntervalRef.current);
      }
    };
  }, []);

  const handleEdit = (connection: Connection) => {
    setSelectedConnection(connection);
    setEditFrequency(connection.sync_frequency);
    setEditDialogOpen(true);
  };

  const handleUpdateConnection = async () => {
    if (!selectedConnection) return;

    try {
      setUpdating(true);
      await apiClient.updateConnection(selectedConnection.id, {
        sync_frequency: editFrequency,
      });

      await fetchConnections();
      setEditDialogOpen(false);
      setSelectedConnection(null);
      setEditFrequency('');
    } catch (error) {
      console.error('Failed to update connection:', error);
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedConnection) return;

    try {
      await apiClient.deleteConnection(selectedConnection.id);

      await fetchConnections();
      setDeleteDialogOpen(false);
      setSelectedConnection(null);
    } catch (error) {
      console.error('Failed to delete connection:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      connected: 'default',
      syncing: 'secondary',
      error: 'destructive',
      disconnected: 'outline',
    };

    return (
      <Badge variant={variants[status] || 'outline'} className="capitalize">
        {status}
      </Badge>
    );
  };

  const getProviderInfo = (providerId: string) => {
    return AVAILABLE_PROVIDERS.find(p => p.id === providerId) || AVAILABLE_PROVIDERS[0];
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await apiClient.exportData();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
      a.download = `money-export-${timestamp}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      console.log('Data exported successfully');
    } catch (error) {
      console.error('Failed to export data:', error);
    } finally {
      setExporting(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.name.endsWith('.zip')) {
      setSelectedFile(file);
      setImportError(null);
      setImportResult(null);
      setImportDialogOpen(true);
    } else {
      console.error('Please select a valid ZIP archive');
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;

    setImporting(true);
    setImportError(null);
    try {
      const result = await apiClient.importData(selectedFile, 'merge');

      if (result.success) {
        setImportResult(result);
        console.log('Data imported successfully');
      } else {
        console.error('Import failed');
        setImportResult(result);
      }
    } catch (error: any) {
      console.error('Failed to import data:', error);
      setImportError(error.message || 'Failed to import data. Please check your connection and try again.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your preferences and application settings
        </p>
      </div>

      {/* Available Providers Section */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Available Providers</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Connect your accounts from these financial providers
          </p>
        </div>

        <Separator />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {AVAILABLE_PROVIDERS.map((provider) => {
            const Icon = provider.icon;
            const isConnected = connections.some(c => c.provider === provider.id);
            const isAvailable = provider.status === 'available';

            return (
              <Card key={provider.id} className={!isAvailable ? 'opacity-60' : ''}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className={`p-2 rounded-lg ${provider.color}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    {provider.status === 'coming_soon' && (
                      <Badge variant="outline" className="text-xs">
                        Coming Soon
                      </Badge>
                    )}
                    {provider.status === 'beta' && (
                      <Badge variant="secondary" className="text-xs">
                        Beta
                      </Badge>
                    )}
                    {isConnected && (
                      <Badge variant="default" className="text-xs">
                        Connected
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-lg">{provider.name}</CardTitle>
                  <CardDescription className="text-xs">
                    {provider.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {provider.id === 'wealthsimple' && wealthsimpleCredentials.hasCredentials && !isConnected && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleReconnect}
                      disabled={reconnecting}
                      className="w-full mb-2"
                    >
                      <IconRefresh className="mr-2 h-4 w-4" />
                      {reconnecting ? 'Reconnecting...' : 'Quick Reconnect'}
                    </Button>
                  )}
                  <Button
                    variant={isAvailable ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleConnectProvider(provider.id)}
                    disabled={!isAvailable}
                    className="w-full"
                  >
                    <IconPlus className="mr-2 h-4 w-4" />
                    Connect
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Connected Accounts Section */}
      {connections.length > 0 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Connected Accounts</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your active connections and sync settings
            </p>
          </div>

          <Separator />

          <Card>
            <CardContent className="pt-6">
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading connections...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Provider</TableHead>
                      <TableHead>Connection Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Accounts</TableHead>
                      <TableHead>Last Sync</TableHead>
                      <TableHead>Frequency</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {connections.map((connection) => {
                      const providerInfo = getProviderInfo(connection.provider);
                      const ProviderIcon = providerInfo.icon;

                      return (
                        <TableRow key={connection.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className={`p-1.5 rounded-lg ${providerInfo.color}`}>
                                <ProviderIcon className="h-4 w-4" />
                              </div>
                              <span className="font-medium">{providerInfo.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{connection.name}</div>
                              {connection.last_sync_error && (
                                <div className="text-xs text-destructive mt-0.5">
                                  Error: {connection.last_sync_error}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(connection.status)}
                          </TableCell>
                          <TableCell>
                            {connection.account_count} account{connection.account_count !== 1 ? 's' : ''}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{formatDate(connection.last_sync_at)}</div>
                          </TableCell>
                          <TableCell>
                            <span className="capitalize">{connection.sync_frequency}</span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              {connection.provider === 'wealthsimple' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleReconnectConnection(connection.id)}
                                  disabled={reconnectingConnectionId === connection.id}
                                  className="h-8 w-8 p-0 text-orange-600 hover:text-orange-700"
                                  title="Reconnect account"
                                >
                                  {reconnectingConnectionId === connection.id ? (
                                    <IconLoader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <IconLink className="h-4 w-4" />
                                  )}
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSync(connection.id)}
                                disabled={connection.status === 'syncing' || syncingConnectionId === connection.id}
                                className="h-8 w-8 p-0"
                                title="Sync now"
                              >
                                {syncingConnectionId === connection.id ? (
                                  <IconLoader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <IconRefresh className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewHistory(connection)}
                                className="h-8 w-8 p-0"
                                title="View sync history"
                              >
                                <IconHistory className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(connection)}
                                className="h-8 w-8 p-0"
                                title="Edit settings"
                              >
                                <IconEdit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedConnection(connection);
                                  setDeleteDialogOpen(true);
                                }}
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                title="Disconnect"
                              >
                                <IconTrash className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Data Management Section */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Data Management</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Export your data for backup or import from a previous export
          </p>
        </div>

        <Separator />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Export Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconDownload className="h-5 w-5" />
                Export Data
              </CardTitle>
              <CardDescription>
                Download all your financial data as a backup archive
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <p className="mb-2">Export includes:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>All accounts and balances</li>
                  <li>Holdings and transactions</li>
                  <li>Mortgages, loans, and assets</li>
                  <li>Recurring expenses and projections</li>
                </ul>
              </div>
              <Button
                onClick={handleExport}
                disabled={exporting}
                className="w-full"
              >
                {exporting ? (
                  <>
                    <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <IconDownload className="mr-2 h-4 w-4" />
                    Export Data
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Import Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconUpload className="h-5 w-5" />
                Import Data
              </CardTitle>
              <CardDescription>
                Restore data from a previous export archive
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <IconAlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Importing will merge with existing data. Review carefully after import.
                </AlertDescription>
              </Alert>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept=".zip"
                className="hidden"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="w-full"
              >
                <IconUpload className="mr-2 h-4 w-4" />
                Select Archive to Import
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <WealthsimpleConnectDialog
        open={showConnectDialog && selectedProvider === 'wealthsimple'}
        onOpenChange={setShowConnectDialog}
        onSuccess={() => {
          setShowConnectDialog(false);
          setSelectedProvider('');
          fetchConnections();
        }}
      />

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Connection Settings</DialogTitle>
            <DialogDescription>
              Update the sync frequency for {selectedConnection?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="frequency">Sync Frequency</Label>
              <Select value={editFrequency} onValueChange={setEditFrequency}>
                <SelectTrigger id="frequency">
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual Only</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                How often should we automatically sync this connection?
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateConnection} disabled={updating}>
              {updating ? 'Updating...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the connection and stop automatic syncing. Your locally stored
              account data will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Disconnect</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={importDialogOpen} onOpenChange={(open) => {
        setImportDialogOpen(open);
        if (!open) {
          setSelectedFile(null);
          setImportResult(null);
          setImportError(null);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }
      }}>
        <DialogContent className="!max-w-4xl sm:!max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Data</DialogTitle>
            <DialogDescription>
              Import data from: {selectedFile?.name}
            </DialogDescription>
          </DialogHeader>

          {importError && (
            <Alert variant="destructive">
              <IconAlertCircle className="h-4 w-4" />
              <AlertTitle>Import Error</AlertTitle>
              <AlertDescription>{importError}</AlertDescription>
            </Alert>
          )}

          {!importResult && !importError && (
            <>
              <Alert>
                <IconAlertCircle className="h-4 w-4" />
                <AlertDescription>
                  This will merge the imported data with your existing data.
                  New records will be added and existing records will be updated.
                </AlertDescription>
              </Alert>

              {importing && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <IconLoader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Importing data...</span>
                  </div>
                </div>
              )}
            </>
          )}

          {importResult && (
            <div className="space-y-4">
              <Alert variant={importResult.success ? "default" : "destructive"}>
                <IconAlertCircle className="h-4 w-4" />
                <AlertTitle>
                  {importResult.success ? 'Import Successful' : 'Import Failed'}
                </AlertTitle>
                <AlertDescription>
                  {importResult.success
                    ? 'Your data has been imported successfully. Navigate to the relevant pages (Accounts, Dashboard, etc.) to view your imported data.'
                    : 'Some errors occurred during import. Check the details below.'}
                </AlertDescription>
              </Alert>

              {/* Summary Table */}
              {importResult.summary && Object.keys(importResult.summary).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Import Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-96 overflow-y-auto">
                      <Table>
                        <TableHeader className="sticky top-0 bg-background">
                          <TableRow>
                            <TableHead>Table</TableHead>
                            <TableHead className="text-right">Created</TableHead>
                            <TableHead className="text-right">Updated</TableHead>
                            <TableHead className="text-right">Skipped</TableHead>
                            <TableHead className="text-right">Errors</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {Object.entries(importResult.summary || {}).map(([table, stats]: [string, any]) => (
                            <TableRow key={table}>
                              <TableCell className="font-medium">{table}</TableCell>
                              <TableCell className="text-right text-green-600 font-semibold">{stats.created || 0}</TableCell>
                              <TableCell className="text-right text-blue-600 font-semibold">{stats.updated || 0}</TableCell>
                              <TableCell className="text-right text-gray-600">{stats.skipped || 0}</TableCell>
                              <TableCell className="text-right text-red-600 font-semibold">{stats.errors || 0}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Warnings */}
              {importResult.warnings && importResult.warnings.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base text-yellow-600">Warnings</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-48 overflow-y-auto space-y-2">
                      {importResult.warnings.map((warning: string, i: number) => (
                        <div key={i} className="text-sm text-yellow-700 dark:text-yellow-500 p-2 bg-yellow-50 dark:bg-yellow-950 rounded border border-yellow-200 dark:border-yellow-800">
                          {warning}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Errors */}
              {importResult.errors && importResult.errors.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base text-red-600">Errors ({importResult.errors.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {importResult.errors.map((error: any, i: number) => (
                        <div key={i} className="p-3 bg-red-50 dark:bg-red-950 rounded border border-red-200 dark:border-red-800">
                          <div className="font-semibold text-sm text-red-700 dark:text-red-400">
                            {error.table ? `Table: ${error.table}` : 'General Error'}
                          </div>
                          <div className="text-sm text-red-600 dark:text-red-300 mt-1 font-mono break-words">
                            {error.message}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
              {importResult || importError ? 'Close' : 'Cancel'}
            </Button>
            {!importResult && (
              <Button
                onClick={handleImport}
                disabled={importing}
              >
                {importing ? 'Importing...' : importError ? 'Retry Import' : 'Import Data'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={historyDialogOpen} onOpenChange={handleCloseHistoryModal}>
        <DialogContent className="!max-w-5xl sm:!max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Sync History
              {syncingConnectionId && (
                <Badge variant="secondary" className="ml-2">
                  <IconLoader2 className="h-3 w-3 mr-1 animate-spin" />
                  Syncing...
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              Recent sync activity for {historyConnection?.name}
            </DialogDescription>
          </DialogHeader>

          {loadingHistory ? (
            <div className="flex items-center justify-center py-8">
              <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : syncHistory ? (
            <div className="space-y-4">
              {/* Completion Alert */}
              {!syncingConnectionId && syncHistory.summary.total_jobs > 0 && (
                <Alert variant={syncHistory.summary.failed_jobs > 0 ? "destructive" : "default"}>
                  <IconAlertCircle className="h-4 w-4" />
                  <AlertTitle>
                    {syncHistory.summary.failed_jobs > 0 ? 'Sync Completed with Errors' : 'Sync Completed Successfully'}
                  </AlertTitle>
                  <AlertDescription>
                    {syncHistory.summary.failed_jobs > 0
                      ? `${syncHistory.summary.failed_jobs} job(s) failed. ${syncHistory.summary.completed_jobs} completed successfully.`
                      : `All ${syncHistory.summary.completed_jobs} sync job(s) completed. ${syncHistory.summary.total_created} items created, ${syncHistory.summary.total_updated} updated.`
                    }
                  </AlertDescription>
                </Alert>
              )}

              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">{syncHistory.summary.total_jobs}</div>
                    <div className="text-xs text-muted-foreground">Total Syncs</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-green-600">{syncHistory.summary.completed_jobs}</div>
                    <div className="text-xs text-muted-foreground">Completed</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-blue-600">{syncHistory.summary.running_jobs}</div>
                    <div className="text-xs text-muted-foreground">Running</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-red-600">{syncHistory.summary.failed_jobs}</div>
                    <div className="text-xs text-muted-foreground">Failed</div>
                  </CardContent>
                </Card>
              </div>

              {/* Sync Jobs List */}
              {syncHistory.jobs && syncHistory.jobs.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Sync Jobs (Last 24 Hours)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-96 overflow-y-auto">
                      <Table>
                        <TableHeader className="sticky top-0 bg-background">
                          <TableRow>
                            <TableHead>Account</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Started</TableHead>
                            <TableHead>Completed</TableHead>
                            <TableHead className="text-right">Processed</TableHead>
                            <TableHead className="text-right">Created</TableHead>
                            <TableHead className="text-right">Updated</TableHead>
                            <TableHead className="text-right">Failed</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {syncHistory.jobs.map((job: any) => (
                            <TableRow key={job.id}>
                              <TableCell className="font-medium">{job.account_name || 'Unknown'}</TableCell>
                              <TableCell>
                                <span className="capitalize text-xs bg-muted px-2 py-1 rounded">{job.type}</span>
                              </TableCell>
                              <TableCell>
                                {job.status === 'completed' && (
                                  <Badge variant="default" className="bg-green-600">Completed</Badge>
                                )}
                                {job.status === 'running' && (
                                  <Badge variant="secondary">Running</Badge>
                                )}
                                {job.status === 'failed' && (
                                  <Badge variant="destructive">Failed</Badge>
                                )}
                                {job.status === 'pending' && (
                                  <Badge variant="outline">Pending</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-xs">
                                {job.started_at ? new Date(job.started_at).toLocaleString() : '-'}
                              </TableCell>
                              <TableCell className="text-xs">
                                {job.completed_at ? new Date(job.completed_at).toLocaleString() : '-'}
                              </TableCell>
                              <TableCell className="text-right">{job.items_processed}</TableCell>
                              <TableCell className="text-right text-green-600">{job.items_created}</TableCell>
                              <TableCell className="text-right text-blue-600">{job.items_updated}</TableCell>
                              <TableCell className="text-right text-red-600">{job.items_failed}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No sync history available
                </div>
              )}

              {/* Last Sync Info */}
              {syncHistory.last_sync_at && (
                <div className="text-sm text-muted-foreground">
                  Last synced: {new Date(syncHistory.last_sync_at).toLocaleString()}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No sync history available
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseHistoryModal}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
