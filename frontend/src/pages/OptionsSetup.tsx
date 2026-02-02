import { useParams, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { IconArrowLeft } from '@tabler/icons-react';
import { useOptionsSummary } from '@/hooks/use-options';
import { GrantForm } from '@/components/options/GrantForm';

export function OptionsSetup() {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();
  const { data: summary, isLoading } = useOptionsSummary(accountId || '');

  // Redirect to dashboard if grants already exist
  useEffect(() => {
    if (!isLoading && summary && summary.total_grants > 0) {
      navigate(`/accounts/${accountId}/options`, { replace: true });
    }
  }, [isLoading, summary, accountId, navigate]);

  if (!accountId) {
    return <div>Account ID not found</div>;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/accounts')}
        >
          <IconArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Set Up Stock Options</h1>
          <p className="text-muted-foreground mt-2">
            Add your first equity grant to get started tracking your stock options, RSUs, or RSAs
          </p>
        </div>
      </div>

      <GrantForm
        accountId={accountId}
        onSuccess={() => navigate(`/accounts/${accountId}/options`)}
        onCancel={() => navigate('/accounts')}
      />
    </div>
  );
}
