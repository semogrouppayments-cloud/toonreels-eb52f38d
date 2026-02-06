import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Settings, BarChart3, Users, Sun, Moon, LogOut } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SidebarMoreMenuProps {
  isCreative: boolean;
}

const SidebarMoreMenu = ({ isCreative }: SidebarMoreMenuProps) => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);

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

          {/* Switch Accounts */}
          <button 
            onClick={() => handleNavigate('/auth')}
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
      </PopoverContent>
    </Popover>
  );
};

export default SidebarMoreMenu;
