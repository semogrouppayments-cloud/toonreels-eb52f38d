import { Film, Search, Upload, User, Trophy } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Persistent cache that survives component re-mounts
const creativeStatusCache = new Map<string, boolean>();
let cachedUserId: string | null = null;

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Initialize with cached value if available to prevent flicker
  const [isCreative, setIsCreative] = useState<boolean>(() => {
    if (cachedUserId && creativeStatusCache.has(cachedUserId)) {
      return creativeStatusCache.get(cachedUserId)!;
    }
    return false;
  });
  const [isLoaded, setIsLoaded] = useState(() => {
    // If we have a cached value, consider it loaded immediately
    return cachedUserId !== null && creativeStatusCache.has(cachedUserId);
  });
  
  const isMounted = useRef(true);
  const hasChecked = useRef(false);

  const checkUserType = useCallback(async (forceRefresh = false) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!isMounted.current) return;
      
      if (user) {
        cachedUserId = user.id;
        
        // Check cache first (unless forced refresh)
        if (!forceRefresh && creativeStatusCache.has(user.id)) {
          setIsCreative(creativeStatusCache.get(user.id)!);
          setIsLoaded(true);
          return;
        }
        
        const { data: roles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);
        
        if (!isMounted.current) return;
        
        const creative = roles?.some(r => r.role === 'creative') || false;
        creativeStatusCache.set(user.id, creative);
        setIsCreative(creative);
      } else {
        cachedUserId = null;
        setIsCreative(false);
      }
    } catch {
      if (isMounted.current) {
        setIsCreative(false);
      }
    }
    
    if (isMounted.current) {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    
    // Only check once per component lifecycle, or if no cached data
    if (!hasChecked.current || !isLoaded) {
      hasChecked.current = true;
      checkUserType();
    }
    
    // Listen for auth changes to refresh creative status
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        // Clear cache for fresh check on login
        creativeStatusCache.clear();
        cachedUserId = null;
        checkUserType(true);
      } else if (event === 'SIGNED_OUT') {
        creativeStatusCache.clear();
        cachedUserId = null;
        setIsCreative(false);
        setIsLoaded(true);
      }
    });
    
    return () => {
      isMounted.current = false;
      subscription.unsubscribe();
    };
  }, [checkUserType, isLoaded]);

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
          <Film className="h-5 w-5" />
          <span className="text-[10px] font-semibold">Reels</span>
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
          <span className="text-[10px] font-semibold">Explore</span>
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
          onClick={() => navigate('/milestones')}
          className={`flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all ${
            isActive('/milestones')
              ? 'text-primary bg-primary/10'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Trophy className="h-5 w-5" />
          <span className="text-[10px] font-semibold">Badges</span>
        </button>

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
