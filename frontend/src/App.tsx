import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/query-client';
import { AuthProvider, useAuth } from './lib/auth-context';
import { DemoModeProvider } from './lib/demo-context';
import { ThemeProvider } from './lib/theme-context';
import { Toaster } from './components/ui/sonner';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { Accounts } from './pages/Accounts';
import { AccountNew } from './pages/AccountNew';
import { AccountDetail } from './pages/AccountDetail';
import { MortgageSetup } from './pages/MortgageSetup';
import { MortgageDashboard } from './pages/MortgageDashboard';
import { LoanSetup } from './pages/LoanSetup';
import { LoanDashboard } from './pages/LoanDashboard';
import { Assets } from './pages/Assets';
import { AssetSetup } from './pages/AssetSetup';
import { AssetDashboard } from './pages/AssetDashboard';
import { OptionsSetup } from './pages/OptionsSetup';
import { OptionsDashboard } from './pages/OptionsDashboard';
import { IncomeTaxes } from './pages/IncomeTaxes';
import { Simulation } from './pages/Simulation';
import { RecurringExpenses } from './pages/RecurringExpenses';
import { Settings } from './pages/Settings';
import { PasskeyLogin } from './pages/auth/PasskeyLogin';
import { PasskeyRegister } from './pages/auth/PasskeyRegister';

// Protected Route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <DemoModeProvider>
            <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<PasskeyLogin />} />
              <Route path="/register" element={<PasskeyRegister />} />

              {/* Protected routes */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <DashboardLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="/accounts" replace />} />
                <Route path="accounts" element={<Accounts />} />
                <Route path="accounts/new" element={<AccountNew />} />
                <Route path="accounts/:id" element={<AccountDetail />} />
                <Route path="accounts/:accountId/mortgage/setup" element={<MortgageSetup />} />
                <Route path="accounts/:accountId/mortgage" element={<MortgageDashboard />} />
                <Route path="accounts/:accountId/loan/setup" element={<LoanSetup />} />
                <Route path="accounts/:accountId/loan" element={<LoanDashboard />} />
                <Route path="assets" element={<Assets />} />
                <Route path="accounts/:accountId/asset/setup" element={<AssetSetup />} />
                <Route path="accounts/:accountId/asset" element={<AssetDashboard />} />
                <Route path="accounts/:accountId/options/setup" element={<OptionsSetup />} />
                <Route path="accounts/:accountId/options" element={<OptionsDashboard />} />
                <Route path="income" element={<IncomeTaxes />} />
                <Route path="simulation" element={<Simulation />} />
                <Route path="expenses" element={<RecurringExpenses />} />
                <Route path="settings" element={<Settings />} />
              </Route>
            </Routes>
              <Toaster />
            </BrowserRouter>
          </DemoModeProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
