import { Home, Upload, User } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isCreative, setIsCreative] = useState(false);

  useEffect(() => {
    const checkUserType = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: roles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);
        
        setIsCreative(roles?.some(r => r.role === 'creative') || false);
      }
    };

    checkUserType();
  }, []);

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="fixed bottom-4 left-4 right-4 bg-card/95 backdrop-blur-lg border-2 border-border rounded-3xl shadow-2xl z-50 max-w-lg mx-auto">
      <div className="flex items-center justify-around h-16 px-2">
        <button
          onClick={() => navigate('/feed')}
          className={`flex flex-col items-center gap-1 px-4 py-2 rounded-2xl transition-all ${
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
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-2xl transition-all ${
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
          onClick={() => navigate('/profile')}
          className={`flex flex-col items-center gap-1 px-4 py-2 rounded-2xl transition-all ${
            isActive('/profile')
              ? 'text-primary bg-primary/10'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <User className="h-6 w-6" />
          <span className="text-xs font-semibold">Profile</span>
        </button>
      </div>
    </nav>
  );
};

export default BottomNav;
