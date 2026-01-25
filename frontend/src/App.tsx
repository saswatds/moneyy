import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/query-client';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { Dashboard } from './pages/Dashboard';
import { Accounts } from './pages/Accounts';
import { AccountNew } from './pages/AccountNew';
import { AccountDetail } from './pages/AccountDetail';
import { MortgageSetup } from './pages/MortgageSetup';
import { MortgageDashboard } from './pages/MortgageDashboard';
import { Analytics } from './pages/Analytics';
import { Projections } from './pages/Projections';
import { Settings } from './pages/Settings';
import Connections from './pages/Connections';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<DashboardLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="accounts" element={<Accounts />} />
            <Route path="accounts/new" element={<AccountNew />} />
            <Route path="accounts/:id" element={<AccountDetail />} />
            <Route path="accounts/:accountId/mortgage/setup" element={<MortgageSetup />} />
            <Route path="accounts/:accountId/mortgage" element={<MortgageDashboard />} />
            <Route path="connections" element={<Connections />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="projections" element={<Projections />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
