import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from './api-client';

interface DemoModeContextType {
  isDemoMode: boolean;
  enterDemoMode: () => Promise<void>;
  exitDemoMode: () => void;
  resetDemoData: () => Promise<void>;
  isLoading: boolean;
}

const DemoModeContext = createContext<DemoModeContextType | undefined>(undefined);

export function DemoModeProvider({ children }: { children: ReactNode }) {
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const queryClient = useQueryClient();

  // Check demo mode status on mount
  useEffect(() => {
    const demoMode = localStorage.getItem('demo_mode');
    setIsDemoMode(demoMode === 'true');
  }, []);

  const enterDemoMode = async () => {
    try {
      setIsLoading(true);

      // Seed demo data
      await apiClient.seedDemoData();

      // Set demo mode flag
      localStorage.setItem('demo_mode', 'true');
      setIsDemoMode(true);

      // Invalidate all queries to refresh data
      queryClient.invalidateQueries();

      // Reload page to ensure fresh state
      window.location.reload();
    } catch (error) {
      console.error('Failed to enter demo mode:', error);
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

  const resetDemoData = async () => {
    try {
      setIsLoading(true);

      // Reset demo data
      await apiClient.resetDemoData();

      // Invalidate all queries to refresh data
      queryClient.invalidateQueries();

      // Reload page to ensure fresh state
      window.location.reload();
    } catch (error) {
      console.error('Failed to reset demo data:', error);
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
        resetDemoData,
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
