import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { startRegistration } from '@simplewebauthn/browser';
import { useAuth } from '../../lib/auth-context';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Alert, AlertDescription } from '../../components/ui/alert';

export function PasskeyRegister() {
  const navigate = useNavigate();
  const { setToken, setUser, isAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    // Check if already registered
    const checkStatus = async () => {
      try {
        const response = await fetch('/api/auth/status');
        const data = await response.json();

        if (data.registered && !data.needs_setup) {
          // Already has a passkey, redirect to login
          setAlreadyRegistered(true);
          setTimeout(() => {
            navigate('/login');
          }, 2000);
        }
      } catch (err) {
        console.error('Failed to check registration status:', err);
      }
    };
    checkStatus();
  }, [navigate]);

  const handleRegister = async () => {
    setIsLoading(true);
    setError('');

    try {
      // Step 1: Get registration options from server
      const beginResponse = await fetch('/api/auth/register/begin', {
        method: 'POST',
      });

      if (!beginResponse.ok) {
        const errorData = await beginResponse.json();
        if (errorData.error === 'already_registered') {
          throw new Error('Passkey already registered. Please sign in instead.');
        }
        throw new Error('Failed to start registration');
      }

      const options = await beginResponse.json();

      // Step 2: Create passkey
      // Extract publicKey from the response if it exists (go-webauthn format)
      const credentialOptions = options.publicKey || options;
      const credential = await startRegistration(credentialOptions);

      // Step 3: Send credential to server
      const finishResponse = await fetch('/api/auth/register/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credential),
      });

      if (!finishResponse.ok) {
        const errorData = await finishResponse.json();
        throw new Error(errorData.error || 'Registration failed');
      }

      const result = await finishResponse.json();

      // Store token and user
      setToken(result.token);
      setUser(result.user);

      // Navigate to dashboard
      navigate('/');
    } catch (err: any) {
      console.error('Registration error:', err);
      if (err.message.includes('already_registered')) {
        setError('Passkey already registered. Redirecting to login...');
        setTimeout(() => navigate('/login'), 2000);
      } else {
        setError(err.message || 'Registration failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // If already registered, show message and redirect
  if (alreadyRegistered) {
    return (
      <div className="min-h-screen flex items-center justify-center app-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Passkey Already Exists</CardTitle>
            <CardDescription>
              You already have a passkey registered
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>
                Redirecting to login page...
              </AlertDescription>
            </Alert>
            <Button onClick={() => navigate('/login')} className="w-full" size="lg">
              Go to Login
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
          <CardTitle>Set Up Your Passkey</CardTitle>
          <CardDescription>
            Create a passkey to securely access your account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <h3 className="font-medium">What is a passkey?</h3>
            <p className="text-sm text-muted-foreground">
              A passkey is a secure, password-less way to sign in. It uses your device's
              biometric authentication (fingerprint, face ID) or PIN.
            </p>
          </div>

          <Button
            onClick={handleRegister}
            disabled={isLoading}
            className="w-full"
            size="lg"
          >
            {isLoading ? 'Creating Passkey...' : 'Create Passkey'}
          </Button>

          <p className="text-sm text-muted-foreground text-center">
            Already have a passkey?{' '}
            <button
              onClick={() => navigate('/login')}
              className="text-primary hover:underline"
            >
              Sign in
            </button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
