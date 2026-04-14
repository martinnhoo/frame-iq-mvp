import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAccountContext } from '../../providers/AccountProvider';
import { useMoneyTracker } from '../../hooks/useMoneyTracker';
import { timeAgo } from '../../lib/format';
import { supabase } from '../../lib/supabase';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
  Home,
  Clock,
  TrendingUp,
  Plus,
  Settings,
  ChevronDown,
  LogOut,
} from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Feed', path: '/feed', icon: Home },
  { label: 'History', path: '/history', icon: Clock },
  { label: 'Patterns', path: '/patterns', icon: TrendingUp },
  { label: 'Create', path: '/create', icon: Plus },
  { label: 'Settings', path: '/settings', icon: Settings },
];

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentAccount, accounts, setCurrentAccount, user } = useAccountContext();
  const { tracker } = useMoneyTracker(currentAccount?.id ?? null);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/onboarding');
  };

  const lastAnalysisDate = tracker?.updated_at || null;

  return (
    <div className="flex h-screen bg-[#0a0e17]">
      {/* Sidebar */}
      <aside className="w-[220px] border-r border-sky-500/10 bg-[#0d1117] flex flex-col">
        {/* Logo */}
        <div className="p-4 border-b border-sky-500/10">
          <div className="text-2xl font-bold bg-gradient-to-r from-sky-400 to-blue-500 bg-clip-text text-transparent">
            ab
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'text-sky-500 bg-sky-500/10'
                    : 'text-gray-400 hover:text-gray-300 hover:bg-sky-500/5'
                }`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Sync Status */}
        <div className="px-3 py-3 border-t border-sky-500/10">
          <div className="text-xs text-gray-500">
            {lastAnalysisDate ? `Última análise: ${timeAgo(lastAnalysisDate)}` : 'Nunca analisado'}
          </div>
        </div>

        {/* Account Switcher */}
        <div className="px-3 py-3 border-t border-sky-500/10">
          <DropdownMenu open={isAccountMenuOpen} onOpenChange={setIsAccountMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between text-left"
                size="sm"
              >
                <span className="text-xs truncate">
                  {currentAccount?.account_name || 'No account'}
                </span>
                <ChevronDown size={14} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Accounts</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {accounts.map((account) => (
                <DropdownMenuItem
                  key={account.id}
                  onClick={() => {
                    setCurrentAccount(account);
                    setIsAccountMenuOpen(false);
                  }}
                  className={currentAccount?.id === account.id ? 'bg-sky-500/10' : ''}
                >
                  {account.account_name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-400">
                <LogOut size={14} className="mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
