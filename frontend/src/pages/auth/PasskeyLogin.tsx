import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { startAuthentication } from '@simplewebauthn/browser';
import { useAuth } from '../../lib/auth-context';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Alert, AlertDescription } from '../../components/ui/alert';

export function PasskeyLogin() {
  const navigate = useNavigate();
  const { setToken, setUser, isAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [needsSetup, setNeedsSetup] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    // Check if registration is needed
    const checkStatus = async () => {
      try {
        const response = await fetch('/api/auth/status');
        const data = await response.json();

        if (data.needs_setup || !data.registered) {
          // Automatically redirect to registration if no passkey exists
          setTimeout(() => {
            navigate('/register');
          }, 1500);
          setNeedsSetup(true);
        } else {
          setNeedsSetup(false);
        }
      } catch (err) {
        console.error('Failed to check auth status:', err);
        setError('Failed to check authentication status');
      } finally {
        setIsCheckingStatus(false);
      }
    };
    checkStatus();
  }, [navigate]);

  const handleLogin = async () => {
    setIsLoading(true);
    setError('');

    try {
      // Step 1: Get challenge from server
      const beginResponse = await fetch('/api/auth/login/begin', {
        method: 'POST',
      });

      if (!beginResponse.ok) {
        const errorData = await beginResponse.json().catch(() => ({}));

        // If no credentials, redirect to registration
        if (errorData.error === 'no_credentials') {
          setError('No passkey found. Redirecting to registration...');
          setTimeout(() => {
            navigate('/register');
          }, 1500);
          return;
        }

        throw new Error(errorData.error || 'Failed to start login process');
      }

      const options = await beginResponse.json();

      // Step 2: Prompt for passkey
      // Extract publicKey from the response if it exists (go-webauthn format)
      const credentialOptions = options.publicKey || options;
      const credential = await startAuthentication(credentialOptions);

      // Step 3: Send credential to server for verification
      const finishResponse = await fetch('/api/auth/login/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credential),
      });

      if (!finishResponse.ok) {
        const errorData = await finishResponse.json();
        throw new Error(errorData.error || 'Login failed');
      }

      const result = await finishResponse.json();

      // Store token and user
      setToken(result.token);
      setUser(result.user);

      // Navigate to dashboard
      navigate('/');
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading while checking status
  if (isCheckingStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center app-background">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground">Checking authentication status...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Redirect to registration if needed
  if (needsSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center app-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>No Passkey Found</CardTitle>
            <CardDescription>
              You need to create a passkey before you can log in.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>
                Redirecting to passkey setup...
              </AlertDescription>
            </Alert>
            <Button onClick={() => navigate('/register')} className="w-full" size="lg">
              Set Up Passkey Now
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center app-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign In</CardTitle>
          <CardDescription>
            Use your passkey to sign in to your account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button
            onClick={handleLogin}
            disabled={isLoading}
            className="w-full"
            size="lg"
          >
            {isLoading ? 'Signing In...' : 'Sign In with Passkey'}
          </Button>

          <p className="text-sm text-muted-foreground text-center">
            Lost your passkey? Contact your administrator to reset your account.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
