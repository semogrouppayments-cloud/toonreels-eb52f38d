import { Home, Upload, MessageCircle, User, Moon, Sun } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [isCreative, setIsCreative] = useState(false);

  useEffect(() => {
    const checkUserType = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('user_type')
          .eq('id', user.id)
          .single();
        
        setIsCreative(profile?.user_type === 'creative');
      }
    };

    checkUserType();
  }, []);

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-elevated z-50">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        <button
          onClick={() => navigate('/feed')}
          className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${
            isActive('/feed')
              ? 'text-primary bg-primary/10'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Home className="h-6 w-6" />
          <span className="text-xs font-semibold">Home</span>
        </button>

        {isCreative && (
          <button
            onClick={() => navigate('/upload')}
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${
              isActive('/upload')
                ? 'text-primary bg-primary/10'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Upload className="h-6 w-6" />
            <span className="text-xs font-semibold">Upload</span>
          </button>
        )}

        <button
          onClick={() => navigate('/messages')}
          className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${
            isActive('/messages')
              ? 'text-primary bg-primary/10'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <MessageCircle className="h-6 w-6" />
          <span className="text-xs font-semibold">Messages</span>
        </button>

        <button
          onClick={() => navigate('/profile')}
          className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${
            isActive('/profile')
              ? 'text-primary bg-primary/10'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <User className="h-6 w-6" />
          <span className="text-xs font-semibold">Profile</span>
        </button>

        <button
          onClick={toggleTheme}
          className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl text-muted-foreground hover:text-foreground transition-all"
        >
          {theme === 'dark' ? (
            <Sun className="h-6 w-6" />
          ) : (
            <Moon className="h-6 w-6" />
          )}
          <span className="text-xs font-semibold">
            {theme === 'dark' ? 'Bright' : 'Dark'}
          </span>
        </button>
      </div>
    </div>
  );
};

export default BottomNav;
