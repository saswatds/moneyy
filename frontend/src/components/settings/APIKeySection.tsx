import { useState } from 'react';
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
import { IconPlus, IconEdit, IconTrash, IconLoader2, IconCheck } from '@tabler/icons-react';
import { useAPIKeyStatus, useSaveAPIKey, useDeleteAPIKey } from '@/hooks/use-api-keys';

interface APIKeyCardProps {
  provider: string;
  providerName: string;
}

function APIKeyCard({ provider, providerName }: APIKeyCardProps) {
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

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <IconLoader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    );
  }

  const isConfigured = status?.is_configured;

  return (
    <>
      <div className="flex items-center gap-3">
        {isConfigured ? (
          <>
            <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
              <IconCheck className="h-3 w-3 mr-1" />
              {providerName}: Active
            </Badge>
            <span className="text-xs text-muted-foreground">{status?.name || 'Default'}</span>
            <Button variant="ghost" size="sm" onClick={openUpdateDialog} className="h-6 w-6 p-0">
              <IconEdit className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDeleteDialogOpen(true)} className="h-6 w-6 p-0 text-destructive">
              <IconTrash className="h-3 w-3" />
            </Button>
          </>
        ) : (
          <>
            <span className="text-sm text-muted-foreground">{providerName}: Not configured</span>
            <Button onClick={openAddDialog} size="sm" variant="outline">
              <IconPlus className="h-4 w-4 mr-1" />
              Add Key
            </Button>
          </>
        )}
      </div>

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
    <APIKeyCard
      provider="moneyy"
      providerName="Moneyy"
    />
  );
}
