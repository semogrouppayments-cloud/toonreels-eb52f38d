import { Home, Search, Upload, User } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Cache creative status per user ID to handle multi-user scenarios
const creativeStatusCache = new Map<string, boolean>();

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isCreative, setIsCreative] = useState<boolean>(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const currentUserId = useRef<string | null>(null);

  useEffect(() => {
    const checkUserType = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          currentUserId.current = user.id;
          
          // Check cache first
          if (creativeStatusCache.has(user.id)) {
            setIsCreative(creativeStatusCache.get(user.id)!);
            setIsLoaded(true);
            return;
          }
          
          const { data: roles } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id);
          
          const creative = roles?.some(r => r.role === 'creative') || false;
          creativeStatusCache.set(user.id, creative);
          setIsCreative(creative);
        } else {
          currentUserId.current = null;
          setIsCreative(false);
        }
      } catch {
        setIsCreative(false);
      }
      setIsLoaded(true);
    };

    checkUserType();
    
    // Listen for auth changes to refresh creative status
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        // Clear cache for fresh check on login
        creativeStatusCache.clear();
        checkUserType();
      } else if (event === 'SIGNED_OUT') {
        creativeStatusCache.clear();
        setIsCreative(false);
        setIsLoaded(true);
      }
    });
    
    return () => subscription.unsubscribe();
  }, []);

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="fixed bottom-4 left-4 right-4 bg-card/95 backdrop-blur-lg border-2 border-border rounded-3xl shadow-2xl z-50 max-w-lg mx-auto">
      <div className="flex items-center justify-around h-16 px-2">
        <button
          onClick={() => navigate('/feed')}
          className={`flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all ${
            isActive('/feed')
              ? 'text-primary bg-primary/10'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Home className="h-5 w-5" />
          <span className="text-[10px] font-semibold">Home</span>
        </button>

        <button
          onClick={() => navigate('/search')}
          className={`flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all ${
            isActive('/search')
              ? 'text-primary bg-primary/10'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Search className="h-5 w-5" />
          <span className="text-[10px] font-semibold">Search</span>
        </button>

        {isLoaded && isCreative && (
          <button
            onClick={() => navigate('/upload')}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all ${
              isActive('/upload')
                ? 'text-primary bg-primary/10'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Upload className="h-5 w-5" />
            <span className="text-[10px] font-semibold">Upload</span>
          </button>
        )}

        <button
          onClick={() => navigate('/profile')}
          className={`flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all ${
            isActive('/profile')
              ? 'text-primary bg-primary/10'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <User className="h-5 w-5" />
          <span className="text-[10px] font-semibold">Profile</span>
        </button>
      </div>
    </nav>
  );
};

export default BottomNav;
