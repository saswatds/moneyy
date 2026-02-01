import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { IconLink, IconBuilding, IconRefresh, IconTrash, IconPlus, IconBrandStripe, IconBrandPaypal, IconEdit, IconDownload, IconUpload, IconAlertCircle, IconLoader2, IconHistory, IconChartLine, IconKey, IconDatabase } from '@tabler/icons-react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { WealthsimpleConnectDialog } from '@/components/sync/WealthsimpleConnectDialog';
import { APIKeySection } from '@/components/settings/APIKeySection';
import { useRef } from 'react';
import { apiClient } from '@/lib/api-client';
import { useDemoMode } from '@/lib/demo-context';

interface Connection {
  id: string;
  user_id: string;
  provider: string;
  name: string;
  status: 'connected' | 'disconnected' | 'error' | 'syncing';
  last_sync_at?: string;
  last_sync_error?: string;
  token_expires_at?: string;
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
  const { isDemoMode, enterDemoMode, exitDemoMode, resetDemoData, isLoading: demoLoading } = useDemoMode();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [editFrequency, setEditFrequency] = useState<string>('');
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [updating, setUpdating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [syncingConnectionId, setSyncingConnectionId] = useState<string | null>(null);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyConnection, setHistoryConnection] = useState<Connection | null>(null);
  const [syncHistory, setSyncHistory] = useState<any | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const syncStatusIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    fetchConnections();
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
    const config: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline', label: string, className?: string }> = {
      connected: { variant: 'default', label: 'Connected', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
      syncing: { variant: 'secondary', label: 'Syncing...', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
      error: { variant: 'destructive', label: 'Error' },
      disconnected: { variant: 'destructive', label: 'Auth Required', className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' },
    };

    const statusConfig = config[status] || { variant: 'outline', label: status };

    return (
      <Badge variant={statusConfig.variant} className={statusConfig.className}>
        {statusConfig.label}
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

  const formatTokenExpiry = (dateString?: string) => {
    if (!dateString) return null;
    const expiryDate = new Date(dateString);
    const now = new Date();
    const diffMs = expiryDate.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffMs < 0) {
      return 'Expired';
    } else if (diffHours < 1) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return `Expires in ${diffMinutes} min`;
    } else if (diffHours < 24) {
      return `Expires in ${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
    } else if (diffDays < 7) {
      return `Expires in ${diffDays} day${diffDays !== 1 ? 's' : ''}`;
    } else {
      return `Expires ${expiryDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }
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
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

      {/* Settings Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Setting</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Connected Accounts Row */}
            <TableRow>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <IconBuilding className="h-4 w-4 text-muted-foreground" />
                  Connected Accounts
                </div>
              </TableCell>
              <TableCell>
                {loading ? (
                  <span className="text-muted-foreground">Loading...</span>
                ) : connections.length === 0 ? (
                  <span className="text-muted-foreground">No accounts connected</span>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {connections.map((conn) => (
                      <div key={conn.id} className="flex items-center gap-1.5">
                        {getStatusBadge(conn.status)}
                        <span className="text-sm">{conn.name}</span>
                        {conn.status !== 'disconnected' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSync(conn.id)}
                            disabled={conn.status === 'syncing' || syncingConnectionId === conn.id}
                            className="h-6 w-6 p-0"
                          >
                            {syncingConnectionId === conn.id ? (
                              <IconLoader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <IconRefresh className="h-3 w-3" />
                            )}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewHistory(conn)}
                          className="h-6 w-6 p-0"
                        >
                          <IconHistory className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(conn)}
                          className="h-6 w-6 p-0"
                        >
                          <IconEdit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedConnection(conn);
                            setDeleteDialogOpen(true);
                          }}
                          className="h-6 w-6 p-0 text-destructive"
                        >
                          <IconTrash className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline">
                      <IconPlus className="mr-1 h-4 w-4" />
                      Add
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Select Provider</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {AVAILABLE_PROVIDERS.map((provider) => {
                      const Icon = provider.icon;
                      const isAvailable = provider.status === 'available';
                      return (
                        <DropdownMenuItem
                          key={provider.id}
                          disabled={!isAvailable}
                          onClick={() => {
                            if (isAvailable) {
                              setSelectedProvider(provider.id);
                              if (provider.id === 'wealthsimple') {
                                setShowConnectDialog(true);
                              }
                            }
                          }}
                          className="flex items-center gap-3 cursor-pointer"
                        >
                          <div className={`p-1.5 rounded ${provider.color}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1">
                            <div className="font-medium">{provider.name}</div>
                            {provider.status === 'coming_soon' && (
                              <div className="text-xs text-muted-foreground">Coming Soon</div>
                            )}
                          </div>
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>

            {/* Data Export Row */}
            <TableRow>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <IconDownload className="h-4 w-4 text-muted-foreground" />
                  Export Data
                </div>
              </TableCell>
              <TableCell>
                <span className="text-sm text-muted-foreground">Download all data as backup</span>
              </TableCell>
              <TableCell className="text-right">
                <Button onClick={handleExport} disabled={exporting} size="sm" variant="outline">
                  {exporting ? <IconLoader2 className="mr-1 h-4 w-4 animate-spin" /> : <IconDownload className="mr-1 h-4 w-4" />}
                  {exporting ? 'Exporting...' : 'Export'}
                </Button>
              </TableCell>
            </TableRow>

            {/* Data Import Row */}
            <TableRow>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <IconUpload className="h-4 w-4 text-muted-foreground" />
                  Import Data
                </div>
              </TableCell>
              <TableCell>
                <span className="text-sm text-muted-foreground">Restore from backup (merges with existing)</span>
              </TableCell>
              <TableCell className="text-right">
                <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept=".zip" className="hidden" />
                <Button onClick={() => fileInputRef.current?.click()} size="sm" variant="outline">
                  <IconUpload className="mr-1 h-4 w-4" />
                  Import
                </Button>
              </TableCell>
            </TableRow>

            {/* API Keys Row */}
            <TableRow>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <IconKey className="h-4 w-4 text-muted-foreground" />
                  API Keys
                </div>
              </TableCell>
              <TableCell>
                <APIKeySection />
              </TableCell>
              <TableCell></TableCell>
            </TableRow>

            {/* Demo Mode Row */}
            <TableRow>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <IconChartLine className="h-4 w-4 text-muted-foreground" />
                  Demo Mode
                </div>
              </TableCell>
              <TableCell>
                {isDemoMode ? (
                  <Badge variant="secondary">Active</Badge>
                ) : (
                  <span className="text-sm text-muted-foreground">Try with sample data</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                {isDemoMode ? (
                  <div className="flex gap-2 justify-end">
                    <Button onClick={() => resetDemoData()} disabled={demoLoading} size="sm" variant="outline">
                      <IconRefresh className="mr-1 h-4 w-4" />
                      Reset
                    </Button>
                    <Button onClick={exitDemoMode} disabled={demoLoading} size="sm" variant="outline">
                      Exit Demo
                    </Button>
                  </div>
                ) : (
                  <Button onClick={() => enterDemoMode()} disabled={demoLoading} size="sm" variant="outline">
                    {demoLoading ? 'Loading...' : 'Enter Demo'}
                  </Button>
                )}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>

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
