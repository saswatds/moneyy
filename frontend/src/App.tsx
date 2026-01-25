import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/query-client';
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
import { Projections } from './pages/Projections';
import { RecurringExpenses } from './pages/RecurringExpenses';
import { Settings } from './pages/Settings';
import Connections from './pages/Connections';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<DashboardLayout />}>
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
            <Route path="connections" element={<Connections />} />
            <Route path="projections" element={<Projections />} />
            <Route path="expenses" element={<RecurringExpenses />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
