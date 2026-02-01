import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { IconKey, IconPlus, IconEdit, IconTrash, IconLoader2, IconCheck } from '@tabler/icons-react';
import { useAPIKeyStatus, useSaveAPIKey, useDeleteAPIKey } from '@/hooks/use-api-keys';

interface APIKeyCardProps {
  provider: string;
  providerName: string;
  description: string;
}

function APIKeyCard({ provider, providerName, description }: APIKeyCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [nameInput, setNameInput] = useState('');

  const { data: status, isLoading } = useAPIKeyStatus(provider);
  const saveAPIKey = useSaveAPIKey();
  const deleteAPIKey = useDeleteAPIKey();

  const handleSave = async () => {
    if (!apiKeyInput.trim()) return;

    try {
      await saveAPIKey.mutateAsync({
        provider,
        api_key: apiKeyInput,
        name: nameInput || undefined,
      });
      setDialogOpen(false);
      setApiKeyInput('');
      setNameInput('');
    } catch (error) {
      console.error('Failed to save API key:', error);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteAPIKey.mutateAsync(provider);
      setDeleteDialogOpen(false);
    } catch (error) {
      console.error('Failed to delete API key:', error);
    }
  };

  const openAddDialog = () => {
    setApiKeyInput('');
    setNameInput('');
    setDialogOpen(true);
  };

  const openUpdateDialog = () => {
    setApiKeyInput('');
    setNameInput(status?.name || '');
    setDialogOpen(true);
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

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-4">
            <IconLoader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const isConfigured = status?.is_configured;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <IconKey className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">{providerName}</CardTitle>
                <CardDescription className="text-sm">{description}</CardDescription>
              </div>
            </div>
            <div>
              {isConfigured ? (
                <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                  <IconCheck className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="secondary">Not Configured</Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isConfigured ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Name</span>
                <span className="font-medium">{status?.name || 'Default'}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Last Used</span>
                <span className="font-medium">{formatDate(status?.last_used_at)}</span>
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openUpdateDialog}
                  className="flex-1"
                >
                  <IconEdit className="h-4 w-4 mr-2" />
                  Update Key
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteDialogOpen(true)}
                  className="text-destructive hover:text-destructive"
                >
                  <IconTrash className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <Button onClick={openAddDialog} className="w-full">
              <IconPlus className="h-4 w-4 mr-2" />
              Add API Key
            </Button>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isConfigured ? 'Update' : 'Add'} {providerName} API Key
            </DialogTitle>
            <DialogDescription>
              {isConfigured
                ? 'Enter a new API key to replace the existing one.'
                : `Enter your ${providerName} API key to enable integration.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="api-key">API Key</Label>
              <Input
                id="api-key"
                type="password"
                placeholder="Enter your API key"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name (optional)</Label>
              <Input
                id="name"
                placeholder="e.g., Personal, Work"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                A friendly name to identify this API key
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!apiKeyInput.trim() || saveAPIKey.isPending}
            >
              {saveAPIKey.isPending ? (
                <>
                  <IconLoader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete API Key?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove your {providerName} API key. You will need to add it again to use {providerName} features.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteAPIKey.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function APIKeySection() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">API Integrations</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Connect external services to enhance your financial tracking
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <APIKeyCard
          provider="moneyy"
          providerName="Moneyy"
          description="Fetch tax brackets and financial data"
        />
      </div>
    </div>
  );
}
