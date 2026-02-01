import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  IconPlus,
  IconCopy,
  IconTrash,
  IconDotsVertical,
  IconEdit,
  IconChartBar,
  IconSettings,
} from '@tabler/icons-react';
import type { TaxScenario } from './types';
import { DEFAULT_MARGINAL_RATE } from '@/lib/tax-calculations';

interface TaxSimulatorHeaderProps {
  scenarios: TaxScenario[];
  activeScenarioId: string | null;
  marginalRate: number;
  userMarginalRate?: number; // From user's income tax summary
  onCreateScenario: (name: string) => void;
  onCloneScenario: (scenarioId: string, newName: string) => void;
  onDeleteScenario: (scenarioId: string) => void;
  onRenameScenario: (scenarioId: string, newName: string) => void;
  onSetActiveScenario: (scenarioId: string) => void;
  onSetMarginalRate: (rate: number) => void;
  onCompare: () => void;
}

export function TaxSimulatorHeader({
  scenarios,
  activeScenarioId,
  marginalRate,
  userMarginalRate,
  onCreateScenario,
  onCloneScenario,
  onDeleteScenario,
  onRenameScenario,
  onSetActiveScenario,
  onSetMarginalRate,
  onCompare,
}: TaxSimulatorHeaderProps) {
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [cloneName, setCloneName] = useState('');
  const [renameName, setRenameName] = useState('');
  const [tempMarginalRate, setTempMarginalRate] = useState(marginalRate * 100);

  const activeScenario = scenarios.find(s => s.id === activeScenarioId);

  const handleCreateScenario = () => {
    onCreateScenario(`Scenario ${scenarios.length + 1}`);
  };

  const handleCloneScenario = () => {
    if (!activeScenarioId) return;
    const name = cloneName.trim() || `${activeScenario?.name} (Copy)`;
    onCloneScenario(activeScenarioId, name);
    setCloneName('');
    setCloneDialogOpen(false);
  };

  const handleRenameScenario = () => {
    if (!activeScenarioId || !renameName.trim()) return;
    onRenameScenario(activeScenarioId, renameName.trim());
    setRenameName('');
    setRenameDialogOpen(false);
  };

  const handleSaveSettings = () => {
    onSetMarginalRate(tempMarginalRate / 100);
    setSettingsDialogOpen(false);
  };

  const openRenameDialog = () => {
    setRenameName(activeScenario?.name || '');
    setRenameDialogOpen(true);
  };

  const openSettingsDialog = () => {
    setTempMarginalRate(marginalRate * 100);
    setSettingsDialogOpen(true);
  };

  return (
    <div className="flex items-center justify-between gap-4 pb-4 border-b">
      <div className="flex items-center gap-3">
        <Label htmlFor="scenario" className="text-sm font-medium whitespace-nowrap">
          Scenario:
        </Label>
        {scenarios.length === 0 ? (
          <span className="text-muted-foreground text-sm">No scenarios</span>
        ) : (
          <Select
            value={activeScenarioId || ''}
            onValueChange={onSetActiveScenario}
          >
            <SelectTrigger id="scenario" className="w-[200px]">
              <SelectValue placeholder="Select scenario" />
            </SelectTrigger>
            <SelectContent>
              {scenarios.map(scenario => (
                <SelectItem key={scenario.id} value={scenario.id}>
                  {scenario.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Button variant="outline" size="sm" onClick={handleCreateScenario}>
          <IconPlus className="h-4 w-4 mr-1" />
          New
        </Button>

        {/* Scenario Actions */}
        {activeScenario && (
          <>
            {/* Clone Dialog */}
            <Dialog open={cloneDialogOpen} onOpenChange={setCloneDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <IconCopy className="h-4 w-4 mr-1" />
                  Clone
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Clone Scenario</DialogTitle>
                  <DialogDescription>
                    Create a copy of "{activeScenario.name}" with all its transactions.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="cloneName">New Scenario Name</Label>
                    <Input
                      id="cloneName"
                      value={cloneName}
                      onChange={e => setCloneName(e.target.value)}
                      placeholder={`${activeScenario.name} (Copy)`}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCloneDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCloneScenario}>Clone</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* More Actions Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <IconDotsVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={openRenameDialog}>
                  <IconEdit className="h-4 w-4 mr-2" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-600"
                  onClick={() => {
                    if (window.confirm(`Delete "${activeScenario.name}"? This cannot be undone.`)) {
                      onDeleteScenario(activeScenarioId!);
                    }
                  }}
                >
                  <IconTrash className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Rename Dialog */}
            <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Rename Scenario</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="renameName">Scenario Name</Label>
                    <Input
                      id="renameName"
                      value={renameName}
                      onChange={e => setRenameName(e.target.value)}
                      placeholder="Enter new name"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleRenameScenario} disabled={!renameName.trim()}>
                    Rename
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Settings Dialog */}
        <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" onClick={openSettingsDialog}>
              <IconSettings className="h-4 w-4 mr-1" />
              {(marginalRate * 100).toFixed(0)}% rate
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tax Settings</DialogTitle>
              <DialogDescription>
                Adjust the marginal tax rate used for calculations.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="marginalRate">Marginal Tax Rate (%)</Label>
                <Input
                  id="marginalRate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={tempMarginalRate}
                  onChange={e => setTempMarginalRate(parseFloat(e.target.value) || 0)}
                />
                {userMarginalRate && userMarginalRate > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Your marginal rate from Income &amp; Taxes: {(userMarginalRate * 100).toFixed(1)}%
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Combined federal + provincial rate. Set up Income &amp; Taxes for your actual rate.
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              {userMarginalRate && userMarginalRate > 0 && (
                <Button
                  variant="outline"
                  onClick={() => setTempMarginalRate(userMarginalRate * 100)}
                >
                  Use My Rate ({(userMarginalRate * 100).toFixed(0)}%)
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => setTempMarginalRate(DEFAULT_MARGINAL_RATE * 100)}
              >
                Reset to Default
              </Button>
              <Button onClick={handleSaveSettings}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {scenarios.length >= 2 && (
          <Button variant="outline" size="sm" onClick={onCompare}>
            <IconChartBar className="h-4 w-4 mr-1" />
            Compare
          </Button>
        )}
      </div>
    </div>
  );
}
