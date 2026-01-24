import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { IconLoader2, IconAlertCircle, IconCircleCheck } from '@tabler/icons-react';

interface WealthsimpleConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type Step = 'credentials' | 'otp' | 'success';

export function WealthsimpleConnectDialog({
  open,
  onOpenChange,
  onSuccess,
}: WealthsimpleConnectDialogProps) {
  const [step, setStep] = useState<Step>('credentials');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Credentials step
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // OTP step
  const [credentialId, setCredentialId] = useState('');
  const [otpCode, setOtpCode] = useState('');

  const handleSubmitCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('http://localhost:4000/sync/wealthsimple/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to initiate connection');
      }

      if (data.require_otp) {
        setCredentialId(data.credential_id);
        setStep('otp');
      } else {
        // Direct success (unlikely for Wealthsimple)
        setStep('success');
        setTimeout(() => {
          onSuccess();
          resetForm();
        }, 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('http://localhost:4000/sync/wealthsimple/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          credential_id: credentialId,
          otp_code: otpCode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to verify OTP');
      }

      setStep('success');
      setTimeout(() => {
        onSuccess();
        resetForm();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setStep('credentials');
    setUsername('');
    setPassword('');
    setCredentialId('');
    setOtpCode('');
    setError(null);
    setLoading(false);
  };

  const handleClose = () => {
    if (!loading) {
      onOpenChange(false);
      setTimeout(resetForm, 300); // Reset after dialog animation
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {step === 'credentials' && 'Connect Wealthsimple'}
            {step === 'otp' && 'Enter Authentication Code'}
            {step === 'success' && 'Connection Successful'}
          </DialogTitle>
          <DialogDescription>
            {step === 'credentials' &&
              'Enter your Wealthsimple credentials to connect your account'}
            {step === 'otp' &&
              'Enter the 6-digit code from your authenticator app'}
            {step === 'success' && 'Your Wealthsimple account has been connected'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <IconAlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {step === 'credentials' && (
          <form onSubmit={handleSubmitCredentials} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Email</Label>
              <Input
                id="username"
                type="email"
                placeholder="you@example.com"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <Alert>
              <AlertDescription className="text-sm">
                <p className="font-semibold mb-2">Your credentials are secure:</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>Encrypted with AES-256-GCM before storage</li>
                  <li>Used only for read-only account syncing</li>
                  <li>Never shared with third parties</li>
                </ul>
              </AlertDescription>
            </Alert>

            <div className="flex space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={loading}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading} className="flex-1">
                {loading && <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />}
                Continue
              </Button>
            </div>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={handleSubmitOTP} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="otp">Authentication Code</Label>
              <Input
                id="otp"
                type="text"
                placeholder="123456"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                required
                disabled={loading}
                className="text-center text-2xl tracking-widest"
              />
              <p className="text-sm text-muted-foreground">
                Open your authenticator app and enter the 6-digit code
              </p>
            </div>

            <div className="flex space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setStep('credentials');
                  setOtpCode('');
                  setError(null);
                }}
                disabled={loading}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                type="submit"
                disabled={loading || otpCode.length !== 6}
                className="flex-1"
              >
                {loading && <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verify
              </Button>
            </div>
          </form>
        )}

        {step === 'success' && (
          <div className="py-8 text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <IconCircleCheck className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Successfully Connected!</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Your Wealthsimple account is now syncing. This may take a few moments.
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
