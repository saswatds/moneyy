import { useState, useEffect } from 'react';
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useCreateEquityGrant, useUpdateEquityGrant, useSetVestingSchedule } from '@/hooks/use-options';
import type { GrantType, CreateEquityGrantRequest, UpdateEquityGrantRequest, SetVestingScheduleRequest, EquityGrant } from '@/lib/api-client';

interface GrantFormProps {
  accountId: string;
  onSuccess: () => void;
  onCancel?: () => void;
  editGrant?: EquityGrant;
}

export function GrantForm({ accountId, onSuccess, onCancel, editGrant }: GrantFormProps) {
  const createGrant = useCreateEquityGrant();
  const updateGrant = useUpdateEquityGrant(accountId);
  const setVestingSchedule = useSetVestingSchedule(accountId);

  const isEditing = !!editGrant;
  const [step, setStep] = useState(1);
  const [grantId, setGrantId] = useState<string | null>(editGrant?.id || null);

  // Grant form state
  const [grantType, setGrantType] = useState<GrantType>(editGrant?.grant_type || 'iso');
  const [grantDate, setGrantDate] = useState(editGrant?.grant_date?.split('T')[0] || '');
  const [quantity, setQuantity] = useState(editGrant?.quantity?.toString() || '');
  const [strikePrice, setStrikePrice] = useState(editGrant?.strike_price?.toString() || '');
  const [fmvAtGrant, setFmvAtGrant] = useState(editGrant?.fmv_at_grant?.toString() || '');
  const [expirationDate, setExpirationDate] = useState(editGrant?.expiration_date?.split('T')[0] || '');
  const [companyName, setCompanyName] = useState(editGrant?.company_name || '');
  const [currency, setCurrency] = useState(editGrant?.currency || 'USD');
  const [grantNumber, setGrantNumber] = useState(editGrant?.grant_number || '');
  const [notes, setNotes] = useState(editGrant?.notes || '');

  // Reset form when editGrant changes
  useEffect(() => {
    if (editGrant) {
      setGrantId(editGrant.id);
      setGrantType(editGrant.grant_type);
      setGrantDate(editGrant.grant_date?.split('T')[0] || '');
      setQuantity(editGrant.quantity?.toString() || '');
      setStrikePrice(editGrant.strike_price?.toString() || '');
      setFmvAtGrant(editGrant.fmv_at_grant?.toString() || '');
      setExpirationDate(editGrant.expiration_date?.split('T')[0] || '');
      setCompanyName(editGrant.company_name || '');
      setCurrency(editGrant.currency || 'USD');
      setGrantNumber(editGrant.grant_number || '');
      setNotes(editGrant.notes || '');
    }
  }, [editGrant]);

  // Vesting schedule state
  const [scheduleType, setScheduleType] = useState<'time_based' | 'milestone'>('time_based');
  const [cliffMonths, setCliffMonths] = useState('12');
  const [totalVestingMonths, setTotalVestingMonths] = useState('48');
  const [vestingFrequency, setVestingFrequency] = useState<'monthly' | 'quarterly' | 'annually'>('monthly');
  const [milestoneDescription, setMilestoneDescription] = useState('');

  const [error, setError] = useState<string | null>(null);

  const isOption = grantType === 'iso' || grantType === 'nso';

  const handleSaveGrant = async () => {
    setError(null);

    if (!grantDate || !quantity || !fmvAtGrant || !companyName) {
      setError('Please fill in all required fields');
      return;
    }

    if (isOption && !strikePrice) {
      setError('Strike price is required for stock options');
      return;
    }

    try {
      if (isEditing && editGrant) {
        const data: UpdateEquityGrantRequest = {
          grant_type: grantType,
          grant_date: grantDate,
          quantity: parseInt(quantity),
          fmv_at_grant: parseFloat(fmvAtGrant),
          company_name: companyName,
          currency: currency,
          strike_price: isOption ? parseFloat(strikePrice) : undefined,
          expiration_date: isOption && expirationDate ? expirationDate : undefined,
          grant_number: grantNumber || undefined,
          notes: notes || undefined,
        };

        await updateGrant.mutateAsync({ grantId: editGrant.id, data });
        onSuccess();
      } else {
        const data: CreateEquityGrantRequest = {
          account_id: accountId,
          grant_type: grantType,
          grant_date: grantDate,
          quantity: parseInt(quantity),
          fmv_at_grant: parseFloat(fmvAtGrant),
          company_name: companyName,
          currency: currency,
          strike_price: isOption ? parseFloat(strikePrice) : undefined,
          expiration_date: isOption && expirationDate ? expirationDate : undefined,
          grant_number: grantNumber || undefined,
          notes: notes || undefined,
        };

        const grant = await createGrant.mutateAsync({ accountId, data });
        setGrantId(grant.id);
        setStep(2);
      }
    } catch (err) {
      setError(isEditing ? 'Failed to update grant' : 'Failed to create grant');
    }
  };

  const handleSetVestingSchedule = async () => {
    if (!grantId) return;
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

  const handleSkipVesting = () => {
    onSuccess();
  };

  if (step === 2) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Set Vesting Schedule</CardTitle>
          <CardDescription>
            Configure how your grant vests over time
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
                    Common: 12 months (1 year)
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
                    Common: 48 months (4 years)
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
            </div>
          )}

          {error && (
            <div className="text-sm text-red-500">{error}</div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleSkipVesting}>
              Skip
            </Button>
            <Button
              onClick={handleSetVestingSchedule}
              disabled={setVestingSchedule.isPending}
            >
              {setVestingSchedule.isPending ? 'Saving...' : 'Save Vesting Schedule'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? 'Edit Grant' : 'Grant Details'}</CardTitle>
        <CardDescription>
          {isEditing ? 'Update the details of your equity grant' : 'Enter the details of your equity grant'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Grant Type *</Label>
            <Select value={grantType} onValueChange={(v) => setGrantType(v as GrantType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="iso">ISO (Incentive Stock Option)</SelectItem>
                <SelectItem value="nso">NSO (Non-Qualified Stock Option)</SelectItem>
                <SelectItem value="rsu">RSU (Restricted Stock Unit)</SelectItem>
                <SelectItem value="rsa">RSA (Restricted Stock Award)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              ISO/NSO are options to buy shares at a set price. RSU/RSA are shares granted directly.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Grant Date *</Label>
            <Input
              type="date"
              value={grantDate}
              onChange={(e) => setGrantDate(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              The date your equity grant was officially awarded.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Number of Shares *</Label>
            <Input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="10000"
            />
            <p className="text-xs text-muted-foreground">
              Total shares in this grant (before vesting).
            </p>
          </div>

          <div className="space-y-2">
            <Label>FMV at Grant *</Label>
            <Input
              type="number"
              step="0.01"
              value={fmvAtGrant}
              onChange={(e) => setFmvAtGrant(e.target.value)}
              placeholder="10.00"
            />
            <p className="text-xs text-muted-foreground">
              Fair Market Value per share on the grant date. Used for tax calculations.
            </p>
          </div>
        </div>

        {isOption && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Strike Price *</Label>
              <Input
                type="number"
                step="0.01"
                value={strikePrice}
                onChange={(e) => setStrikePrice(e.target.value)}
                placeholder="10.00"
              />
              <p className="text-xs text-muted-foreground">
                The price you pay per share when exercising. Usually equals FMV at grant.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Expiration Date</Label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={expirationDate}
                  onChange={(e) => setExpirationDate(e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (grantDate) {
                      const date = new Date(grantDate);
                      date.setFullYear(date.getFullYear() + 10);
                      setExpirationDate(date.toISOString().split('T')[0]);
                    }
                  }}
                  disabled={!grantDate}
                >
                  10 yrs
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Options typically expire 10 years from grant, or 90 days after leaving.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Company Name *</Label>
            <Input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Acme Corp"
            />
            <p className="text-xs text-muted-foreground">
              The company issuing this equity grant.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Currency *</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="CAD">CAD</SelectItem>
                <SelectItem value="INR">INR</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Currency of the grant values.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Grant Number</Label>
            <Input
              value={grantNumber}
              onChange={(e) => setGrantNumber(e.target.value)}
              placeholder="Optional identifier"
            />
            <p className="text-xs text-muted-foreground">
              Reference number from your grant agreement (optional).
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Notes</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes about this grant..."
          />
          <p className="text-xs text-muted-foreground">
            Any additional details you want to remember about this grant.
          </p>
        </div>

        {error && (
          <div className="text-sm text-red-500">{error}</div>
        )}

        <div className="flex justify-end gap-2">
          {onCancel && (
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button onClick={handleSaveGrant} disabled={createGrant.isPending || updateGrant.isPending}>
            {createGrant.isPending || updateGrant.isPending
              ? (isEditing ? 'Saving...' : 'Creating...')
              : (isEditing ? 'Save Changes' : 'Continue to Vesting')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
