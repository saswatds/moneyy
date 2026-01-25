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
import { IconLink, IconBuilding, IconRefresh, IconTrash, IconPlus, IconBrandStripe, IconBrandPaypal, IconEdit } from '@tabler/icons-react';
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
import { WealthsimpleConnectDialog } from '@/components/sync/WealthsimpleConnectDialog';

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

  useEffect(() => {
    fetchConnections();
    checkWealthsimpleCredentials();
  }, []);

  const fetchConnections = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:4000/sync/connections');
      const data = await response.json();
      setConnections(data.connections || []);
    } catch (error) {
      console.error('Failed to fetch connections:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkWealthsimpleCredentials = async () => {
    try {
      const response = await fetch('http://localhost:4000/sync/wealthsimple/check-credentials');
      const data = await response.json();
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
      const response = await fetch('http://localhost:4000/sync/wealthsimple/reconnect', {
        method: 'POST',
      });
      const data = await response.json();

      if (data.connection_id) {
        await fetchConnections();
      }
    } catch (error) {
      console.error('Failed to reconnect:', error);
    } finally {
      setReconnecting(false);
    }
  };

  const handleSync = async (connectionId: string) => {
    try {
      await fetch(`http://localhost:4000/sync/connections/${connectionId}/sync`, {
        method: 'POST',
      });

      setTimeout(() => {
        fetchConnections();
      }, 1000);
    } catch (error) {
      console.error('Failed to sync:', error);
    }
  };

  const handleEdit = (connection: Connection) => {
    setSelectedConnection(connection);
    setEditFrequency(connection.sync_frequency);
    setEditDialogOpen(true);
  };

  const handleUpdateConnection = async () => {
    if (!selectedConnection) return;

    try {
      setUpdating(true);
      await fetch(`http://localhost:4000/sync/connections/${selectedConnection.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sync_frequency: editFrequency,
        }),
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
      await fetch(`http://localhost:4000/sync/connections/${selectedConnection.id}`, {
        method: 'DELETE',
      });

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
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSync(connection.id)}
                                disabled={connection.status === 'syncing'}
                                className="h-8 w-8 p-0"
                                title="Sync now"
                              >
                                <IconRefresh className="h-4 w-4" />
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
    </div>
  );
}
