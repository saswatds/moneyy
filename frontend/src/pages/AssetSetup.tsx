import { useParams, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { AssetDetailsForm } from '@/components/AssetDetailsForm';
import { useAssetDetails } from '@/hooks/use-assets';
import { Button } from '@/components/ui/button';
import { IconArrowLeft } from '@tabler/icons-react';

export function AssetSetup() {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();
  const { data: assetDetails, isLoading } = useAssetDetails(accountId || '');

  // Redirect to dashboard if asset details already exist
  useEffect(() => {
    if (!isLoading && assetDetails) {
      navigate(`/accounts/${accountId}/asset`, { replace: true });
    }
  }, [isLoading, assetDetails, accountId, navigate]);

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
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/accounts')}
        >
          <IconArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Set Up Asset Details</h1>
          <p className="text-muted-foreground mt-2">
            Configure all the details about your asset including depreciation settings
          </p>
        </div>
      </div>

      <AssetDetailsForm
        accountId={accountId}
        onSuccess={() => navigate(`/accounts/${accountId}/asset`)}
      />
    </div>
  );
}
