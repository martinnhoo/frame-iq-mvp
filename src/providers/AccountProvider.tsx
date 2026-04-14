import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAccount } from '../hooks/useAccount';
import type { AdAccount } from '../types/database';
import type { User } from '@supabase/supabase-js';

interface AccountContextType {
  currentAccount: AdAccount | null;
  setCurrentAccount: (account: AdAccount) => void;
  accounts: AdAccount[];
  user: User | null;
  isLoading: boolean;
}

const AccountContext = createContext<AccountContextType | undefined>(undefined);

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const { accounts, currentAccount, setCurrentAccount, isLoading: accountsLoading } =
    useAccount();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Get initial auth state
    const getUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data.user) {
        setUser(data.user);
      }
      setIsLoading(false);
    };

    getUser();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const value: AccountContextType = {
    currentAccount,
    setCurrentAccount,
    accounts,
    user,
    isLoading: isLoading || accountsLoading,
  };

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccountContext() {
  const context = useContext(AccountContext);
  if (!context) {
    throw new Error('useAccountContext must be used within AccountProvider');
  }
  return context;
}
