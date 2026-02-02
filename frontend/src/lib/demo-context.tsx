import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from './api-client';

interface DemoModeContextType {
  isDemoMode: boolean;
  enterDemoMode: () => Promise<void>;
  exitDemoMode: () => void;
  seedDemoData: () => Promise<void>;
  clearDemoData: () => Promise<void>;
  isLoading: boolean;
}

const DemoModeContext = createContext<DemoModeContextType | undefined>(undefined);

export function DemoModeProvider({ children }: { children: ReactNode }) {
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const queryClient = useQueryClient();

  // Check demo mode status on mount and show pending toast
  useEffect(() => {
    const demoMode = localStorage.getItem('demo_mode');
    setIsDemoMode(demoMode === 'true');

    // Show toast from previous page load
    const pendingToast = sessionStorage.getItem('demo_toast');
    if (pendingToast) {
      sessionStorage.removeItem('demo_toast');
      toast.success(pendingToast);
    }
  }, []);

  const enterDemoMode = async () => {
    try {
      setIsLoading(true);

      // Seed demo data
      await apiClient.seedDemoData();

      // Set demo mode flag
      localStorage.setItem('demo_mode', 'true');
      setIsDemoMode(true);

      // Store toast message for after reload
      sessionStorage.setItem('demo_toast', 'Entered demo mode');

      // Invalidate all queries to refresh data
      queryClient.invalidateQueries();

      // Reload page to ensure fresh state
      window.location.reload();
    } catch (error) {
      console.error('Failed to enter demo mode:', error);
      toast.error('Failed to enter demo mode');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const exitDemoMode = () => {
    // Clear demo mode flag
    localStorage.removeItem('demo_mode');
    setIsDemoMode(false);

    // Invalidate all queries to refresh data
    queryClient.invalidateQueries();

    // Reload page to ensure fresh state
    window.location.reload();
  };

  const seedDemoData = async () => {
    try {
      setIsLoading(true);

      // Seed demo data
      await apiClient.seedDemoData();

      // Invalidate all queries to refresh data
      await queryClient.invalidateQueries();

      toast.success('Demo data seeded');
    } catch (error) {
      console.error('Failed to seed demo data:', error);
      toast.error('Failed to seed demo data');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const clearDemoData = async () => {
    try {
      setIsLoading(true);

      // Clear demo data
      await apiClient.clearDemoData();

      // Invalidate all queries to refresh data
      await queryClient.invalidateQueries();

      toast.success('Demo data cleared');
    } catch (error) {
      console.error('Failed to clear demo data:', error);
      toast.error('Failed to clear demo data');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DemoModeContext.Provider
      value={{
        isDemoMode,
        enterDemoMode,
        exitDemoMode,
        seedDemoData,
        clearDemoData,
        isLoading,
      }}
    >
      {children}
    </DemoModeContext.Provider>
  );
}

export function useDemoMode() {
  const context = useContext(DemoModeContext);
  if (context === undefined) {
    throw new Error('useDemoMode must be used within a DemoModeProvider');
  }
  return context;
}
