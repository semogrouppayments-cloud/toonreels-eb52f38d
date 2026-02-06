import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Settings, BarChart3, Trophy, Users, Sun, Moon, LogOut, Plus, User } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SavedAccount {
  id: string;
  email: string;
  username: string;
  avatar_url: string | null;
  selected_avatar: string | null;
}

interface SidebarMoreMenuProps {
  isCreative: boolean;
}

const MAX_ACCOUNTS = 3;

const SidebarMoreMenu = ({ isCreative }: SidebarMoreMenuProps) => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [showAccounts, setShowAccounts] = useState(false);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [currentAccountId, setCurrentAccountId] = useState<string | null>(null);

  useEffect(() => {
    // Load saved accounts from localStorage
    const accounts = localStorage.getItem('toonreels_saved_accounts');
    if (accounts) {
      setSavedAccounts(JSON.parse(accounts));
    }
    
    // Get current user
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setCurrentAccountId(user.id);
      }
    });
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast.success('Logged out successfully');
      navigate('/auth');
    } catch (error) {
      toast.error('Failed to log out');
    }
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  const handleSwitchAccount = async (account: SavedAccount) => {
    // For now, redirect to auth page - full account switching would require stored credentials
    toast.info(`Switching to ${account.username}...`);
    navigate('/auth');
    setOpen(false);
  };

  const handleAddAccount = () => {
    if (savedAccounts.length >= MAX_ACCOUNTS) {
      toast.error(`Maximum ${MAX_ACCOUNTS} accounts allowed`);
      return;
    }
    navigate('/auth');
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-base font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-all">
          <Menu className="h-5 w-5" />
          <span>More</span>
        </button>
      </PopoverTrigger>
      <PopoverContent 
        side="top" 
        align="start" 
        className="w-56 p-2 rounded-2xl bg-card border border-border shadow-xl z-[100]"
        sideOffset={8}
      >
        {showAccounts ? (
          <div className="space-y-1">
            {/* Back button */}
            <button 
              onClick={() => setShowAccounts(false)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
            >
              ← Back
            </button>
            
            <div className="h-px bg-border my-2" />
            
            {savedAccounts.length > 0 ? (
              <>
                {savedAccounts.map((account) => (
                  <button 
                    key={account.id}
                    onClick={() => handleSwitchAccount(account)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                      account.id === currentAccountId 
                        ? 'bg-primary/10 text-primary' 
                        : 'text-foreground hover:bg-muted'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm overflow-hidden flex-shrink-0">
                      {account.avatar_url ? (
                        <img src={account.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        account.selected_avatar || <User className="h-4 w-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="truncate">{account.username}</p>
                      {account.id === currentAccountId && (
                        <p className="text-xs text-primary">Current</p>
                      )}
                    </div>
                  </button>
                ))}
                
                {savedAccounts.length < MAX_ACCOUNTS && (
                  <>
                    <div className="h-px bg-border my-2" />
                    <button 
                      onClick={handleAddAccount}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Add Account</span>
                    </button>
                  </>
                )}
              </>
            ) : (
              <div className="px-3 py-4 text-center">
                <p className="text-sm text-muted-foreground mb-3">No accounts saved</p>
                <button 
                  onClick={handleAddAccount}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Account</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            {/* Settings */}
            <button 
              onClick={() => handleNavigate('/settings')}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </button>

            {/* Dashboard - Only for Creatives */}
            {isCreative && (
              <button 
                onClick={() => handleNavigate('/creator-dashboard')}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                <BarChart3 className="h-4 w-4" />
                <span>Dashboard</span>
              </button>
            )}

            {/* Milestones */}
            <button 
              onClick={() => handleNavigate('/milestones')}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              <Trophy className="h-4 w-4" />
              <span>Milestones</span>
            </button>

            {/* Switch Accounts */}
            <button 
              onClick={() => setShowAccounts(true)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              <Users className="h-4 w-4" />
              <span>Switch Accounts</span>
            </button>

            {/* Divider */}
            <div className="h-px bg-border my-2" />

            {/* Theme Toggle */}
            <button 
              onClick={toggleTheme}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="h-4 w-4" />
                  <span>Light Mode</span>
                </>
              ) : (
                <>
                  <Moon className="h-4 w-4" />
                  <span>Dark Mode</span>
                </>
              )}
            </button>

            {/* Divider */}
            <div className="h-px bg-border my-2" />

            {/* Logout */}
            <button 
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span>Log out</span>
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default SidebarMoreMenu;
