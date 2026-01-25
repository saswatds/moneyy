import { useParams } from 'react-router-dom';
import { MortgageDetailsForm } from '@/components/mortgage/MortgageDetailsForm';

export function MortgageSetup() {
  const { accountId } = useParams<{ accountId: string }>();

  if (!accountId) {
    return <div>Account ID not found</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Set Up Mortgage Details</h1>
        <p className="text-muted-foreground mt-2">
          Configure all the details about your mortgage loan
        </p>
      </div>

      <MortgageDetailsForm accountId={accountId} />
    </div>
  );
}
