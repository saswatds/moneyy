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
import { IconLink, IconBuilding, IconRefresh, IconTrash, IconSettings } from '@tabler/icons-react';
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

export default function Connections() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [hasCredentials, setHasCredentials] = useState(false);
  const [credentialsEmail, setCredentialsEmail] = useState<string>('');
  const [reconnecting, setReconnecting] = useState(false);

  // Fetch connections and check credentials on mount
  useEffect(() => {
    fetchConnections();
    checkCredentials();
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

  const checkCredentials = async () => {
    try {
      const response = await fetch('http://localhost:4000/sync/wealthsimple/check-credentials');
      const data = await response.json();
      setHasCredentials(data.has_credentials);
      setCredentialsEmail(data.email || '');
    } catch (error) {
      console.error('Failed to check credentials:', error);
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
        // Refresh connections
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
      // Trigger sync for the connection
      await fetch(`http://localhost:4000/sync/connections/${connectionId}/sync`, {
        method: 'POST',
      });

      // Refresh connections after a brief delay
      setTimeout(() => {
        fetchConnections();
      }, 1000);
    } catch (error) {
      console.error('Failed to sync:', error);
    }
  };

  const handleDelete = async () => {
    if (!selectedConnection) return;

    try {
      await fetch(`http://localhost:4000/sync/connections/${selectedConnection.id}`, {
        method: 'DELETE',
      });

      // Refresh connections
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
      <Badge variant={variants[status] || 'outline'}>
        {status}
      </Badge>
    );
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'wealthsimple':
        return <IconBuilding className="h-8 w-8" />;
      default:
        return <IconBuilding className="h-8 w-8" />;
    }
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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Connections</h1>
          <p className="text-muted-foreground mt-2">
            Manage your financial account connections
          </p>
        </div>
        <div className="flex gap-2">
          {hasCredentials && (
            <Button variant="outline" onClick={handleReconnect} disabled={reconnecting}>
              <IconRefresh className="mr-2 h-4 w-4" />
              {reconnecting ? 'Reconnecting...' : 'Quick Reconnect'}
            </Button>
          )}
          <Button onClick={() => setShowConnectDialog(true)}>
            <IconLink className="mr-2 h-4 w-4" />
            Connect Account
          </Button>
        </div>
      </div>

      <Separator />

      {loading ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">Loading connections...</div>
          </CardContent>
        </Card>
      ) : connections.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <IconLink className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold">No connections yet</h3>
                <p className="text-sm text-muted-foreground">
                  Connect your financial accounts to automatically sync balances and holdings
                </p>
              </div>
              <div className="flex gap-2 justify-center">
                {hasCredentials && (
                  <Button onClick={handleReconnect} disabled={reconnecting}>
                    <IconRefresh className="mr-2 h-4 w-4" />
                    {reconnecting ? 'Reconnecting...' : `Reconnect with Wealthsimple (${credentialsEmail})`}
                  </Button>
                )}
                <Button
                  onClick={() => setShowConnectDialog(true)}
                  variant={hasCredentials ? 'outline' : 'default'}
                >
                  <IconLink className="mr-2 h-4 w-4" />
                  {hasCredentials ? 'New Connection' : 'Connect Your First Account'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {connections.map((connection) => (
            <Card key={connection.id}>
              <CardHeader>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="p-2 bg-muted rounded-lg">
                      {getProviderIcon(connection.provider)}
                    </div>
                    {getStatusBadge(connection.status)}
                  </div>
                  <div className="space-y-1">
                    <CardTitle className="text-xl">{connection.name}</CardTitle>
                    <CardDescription>
                      {connection.account_count} account{connection.account_count !== 1 ? 's' : ''} synced
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Last Sync</p>
                      <p className="font-medium">{formatDate(connection.last_sync_at)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Sync Frequency</p>
                      <p className="font-medium capitalize">{connection.sync_frequency}</p>
                    </div>
                  </div>

                  {connection.last_sync_error && (
                    <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">
                      <p className="font-semibold">Error:</p>
                      <p>{connection.last_sync_error}</p>
                    </div>
                  )}

                  <div className="flex flex-col space-y-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSync(connection.id)}
                      disabled={connection.status === 'syncing'}
                      className="w-full"
                    >
                      <IconRefresh className="mr-2 h-4 w-4" />
                      Sync Now
                    </Button>
                    <Button variant="outline" size="sm" className="w-full">
                      <IconSettings className="mr-2 h-4 w-4" />
                      Settings
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedConnection(connection);
                        setDeleteDialogOpen(true);
                      }}
                      className="w-full"
                    >
                      <IconTrash className="mr-2 h-4 w-4" />
                      Disconnect
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <WealthsimpleConnectDialog
        open={showConnectDialog}
        onOpenChange={setShowConnectDialog}
        onSuccess={() => {
          setShowConnectDialog(false);
          fetchConnections();
        }}
      />

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
