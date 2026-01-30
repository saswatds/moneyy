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
import { Textarea } from '@/components/ui/textarea';
import { useSetVestingSchedule } from '@/hooks/use-options';
import type { SetVestingScheduleRequest } from '@/lib/api-client';

interface VestingScheduleFormProps {
  accountId: string;
  grantId: string;
  onSuccess: () => void;
  onCancel?: () => void;
}

export function VestingScheduleForm({ accountId, grantId, onSuccess, onCancel }: VestingScheduleFormProps) {
  const setVestingSchedule = useSetVestingSchedule(accountId);

  const [scheduleType, setScheduleType] = useState<'time_based' | 'milestone'>('time_based');
  const [cliffMonths, setCliffMonths] = useState('12');
  const [totalVestingMonths, setTotalVestingMonths] = useState('48');
  const [vestingFrequency, setVestingFrequency] = useState<'monthly' | 'quarterly' | 'annually'>('monthly');
  const [milestoneDescription, setMilestoneDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);

    try {
      const data: SetVestingScheduleRequest = {
        grant_id: grantId,
        schedule_type: scheduleType,
        cliff_months: scheduleType === 'time_based' ? parseInt(cliffMonths) || undefined : undefined,
        total_vesting_months: scheduleType === 'time_based' ? parseInt(totalVestingMonths) : undefined,
        vesting_frequency: scheduleType === 'time_based' ? vestingFrequency : undefined,
        milestone_description: scheduleType === 'milestone' ? milestoneDescription : undefined,
      };

      await setVestingSchedule.mutateAsync({ grantId, data });
      onSuccess();
    } catch (err) {
      setError('Failed to set vesting schedule');
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Schedule Type</Label>
        <Select value={scheduleType} onValueChange={(v) => setScheduleType(v as 'time_based' | 'milestone')}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="time_based">Time-Based</SelectItem>
            <SelectItem value="milestone">Milestone-Based</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Time-based vests on a schedule. Milestone-based vests when conditions are met.
        </p>
      </div>

      {scheduleType === 'time_based' ? (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Cliff (months)</Label>
              <Input
                type="number"
                value={cliffMonths}
                onChange={(e) => setCliffMonths(e.target.value)}
                placeholder="12"
              />
              <p className="text-xs text-muted-foreground">
                Period before any shares vest. Common: 12 months.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Total Vesting Period (months)</Label>
              <Input
                type="number"
                value={totalVestingMonths}
                onChange={(e) => setTotalVestingMonths(e.target.value)}
                placeholder="48"
              />
              <p className="text-xs text-muted-foreground">
                Total time to fully vest. Common: 48 months (4 years).
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Vesting Frequency</Label>
            <Select value={vestingFrequency} onValueChange={(v) => setVestingFrequency(v as 'monthly' | 'quarterly' | 'annually')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="annually">Annually</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              How often shares vest after the cliff.
            </p>
          </div>
        </>
      ) : (
        <div className="space-y-2">
          <Label>Milestone Description</Label>
          <Textarea
            value={milestoneDescription}
            onChange={(e) => setMilestoneDescription(e.target.value)}
            placeholder="Describe the milestone conditions..."
          />
          <p className="text-xs text-muted-foreground">
            Describe what needs to happen for shares to vest.
          </p>
        </div>
      )}

      {error && (
        <div className="text-sm text-red-500">{error}</div>
      )}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button
          onClick={handleSubmit}
          disabled={setVestingSchedule.isPending}
        >
          {setVestingSchedule.isPending ? 'Saving...' : 'Save Vesting Schedule'}
        </Button>
      </div>
    </div>
  );
}
