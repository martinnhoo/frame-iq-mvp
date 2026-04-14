import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAccountContext } from '../../providers/AccountProvider';
import { useMoneyTracker } from '../../hooks';
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
  Sparkles,
  Settings,
  ChevronDown,
  LogOut,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

const NAV_ITEMS = [
  { label: 'Feed', path: '/dashboard', icon: Home },
  { label: 'Histórico', path: '/dashboard/history', icon: Clock },
  { label: 'Padrões', path: '/dashboard/patterns', icon: TrendingUp },
  { label: 'Criar', path: '/dashboard/create', icon: Sparkles },
  { label: 'Config', path: '/dashboard/settings', icon: Settings },
];

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentAccount, accounts, setCurrentAccount, user } = useAccountContext();
  const { tracker } = useMoneyTracker(currentAccount?.id ?? undefined);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard' || location.pathname === '/dashboard/feed';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex h-screen bg-[#0a0e17]">
      {/* Sidebar */}
      <aside className="w-[220px] border-r border-sky-500/10 bg-[#0d1117] flex flex-col">
        {/* Logo */}
        <div className="p-4 border-b border-sky-500/10">
          <div className="flex items-center gap-2">
            <div className="text-2xl font-bold bg-gradient-to-r from-sky-400 to-blue-500 bg-clip-text text-transparent">
              AdBrief
            </div>
            <span className="text-[10px] font-semibold text-sky-400/60 bg-sky-500/10 px-1.5 py-0.5 rounded">
              PRO
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);

            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? 'text-sky-400 bg-sky-500/10 shadow-[inset_0_0_0_1px_rgba(14,165,233,0.15)]'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.04]'
                }`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Money Summary Mini */}
        {tracker && (
          <div className="px-3 py-3 border-t border-sky-500/10">
            <div className="bg-sky-500/5 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-gray-500">Total salvo</span>
                <span className="text-sm font-bold text-emerald-400">
                  R${(tracker.total_saved / 100).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                </span>
              </div>
              {tracker.leaking_now > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider text-gray-500">Vazando agora</span>
                  <span className="text-sm font-bold text-red-400 animate-pulse">
                    R${(tracker.leaking_now / 100).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}/dia
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Account Switcher */}
        <div className="px-3 py-3 border-t border-sky-500/10">
          <DropdownMenu open={isAccountMenuOpen} onOpenChange={setIsAccountMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between text-left border-sky-500/10 bg-transparent hover:bg-sky-500/5"
                size="sm"
              >
                <span className="text-xs truncate text-gray-300">
                  {currentAccount?.account_name || 'Selecionar conta'}
                </span>
                <ChevronDown size={14} className="text-gray-500" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-[#111827] border-sky-500/10">
              <DropdownMenuLabel className="text-gray-400">Contas</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-sky-500/10" />
              {accounts.map((account) => (
                <DropdownMenuItem
                  key={account.id}
                  onClick={() => {
                    setCurrentAccount(account);
                    setIsAccountMenuOpen(false);
                  }}
                  className={`cursor-pointer ${currentAccount?.id === account.id ? 'bg-sky-500/10 text-sky-400' : 'text-gray-300'}`}
                >
                  {account.account_name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator className="bg-sky-500/10" />
              <DropdownMenuItem onClick={handleLogout} className="text-red-400 cursor-pointer">
                <LogOut size={14} className="mr-2" />
                Sair
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

export default AppLayout;
