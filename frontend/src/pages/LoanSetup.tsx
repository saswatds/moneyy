import { useParams } from 'react-router-dom';
import { LoanDetailsForm } from '@/components/loan/LoanDetailsForm';

export function LoanSetup() {
  const { accountId } = useParams<{ accountId: string }>();

  if (!accountId) {
    return <div>Account ID not found</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Set Up Loan Details</h1>
        <p className="text-muted-foreground mt-2">
          Configure all the details about your loan
        </p>
      </div>

      <LoanDetailsForm accountId={accountId} />
    </div>
  );
}
