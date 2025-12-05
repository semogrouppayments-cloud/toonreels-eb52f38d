import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import VideoPlayer from '@/components/VideoPlayer';
import VideoSkeleton from '@/components/VideoSkeleton';
import CommentsSheet from '@/components/CommentsSheet';
import BottomNav from '@/components/BottomNav';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';
import toonreelsLogo from '@/assets/toonreels-logo-long.png';

interface Video {
  id: string;
  video_url: string;
  title: string;
  description: string;
  creator_id: string;
  likes_count: number;
  views_count: number;
  profiles: {
    username: string;
    avatar_url: string;
  };
}

// Fisher-Yates shuffle algorithm
const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const Feed = () => {
  const navigate = useNavigate();
  const [videos, setVideos] = useState<Video[]>([]);
  const [currentUserId, setCurrentUserId] = useState('');
  const [isPremium, setIsPremium] = useState(false);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const isPulling = useRef(false);

  const PULL_THRESHOLD = 80;

  useEffect(() => {
    checkAuthAndFetch();
  }, []);

  const checkAuthAndFetch = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate('/auth');
      return;
    }
    
    setCurrentUserId(session.user.id);
    await Promise.all([fetchVideos(), fetchUserProfile()]);
    setIsLoading(false);
  };

  const fetchVideos = async () => {
    const { data } = await supabase
      .from('videos')
      .select(`
        *,
        profiles(username, avatar_url)
      `)
      .order('created_at', { ascending: false });

    // Shuffle videos for variety
    const shuffledVideos = shuffleArray(data || []);
    setVideos(shuffledVideos);
  };

  const fetchUserProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_premium')
        .eq('id', user.id)
        .single();
      
      setIsPremium(profile?.is_premium || false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setActiveIndex(0);
    await fetchVideos();
    setIsRefreshing(false);
    toast.success('Feed refreshed!');
    
    // Scroll to top
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleDeleteVideo = async (videoId: string) => {
    if (confirm('Are you sure you want to delete this video?')) {
      try {
        await supabase.from('videos').delete().eq('id', videoId);
        toast.success('Video deleted');
        fetchVideos();
      } catch (error) {
        toast.error('Failed to delete video');
      }
    }
  };

  // Handle scroll snap to detect active video
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const scrollTop = containerRef.current.scrollTop;
    const height = window.innerHeight;
    const newIndex = Math.round(scrollTop / height);
    if (newIndex !== activeIndex && newIndex >= 0 && newIndex < videos.length) {
      setActiveIndex(newIndex);
    }
  }, [activeIndex, videos.length]);

  // Pull to refresh handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (containerRef.current?.scrollTop === 0) {
      touchStartY.current = e.touches[0].clientY;
      isPulling.current = true;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling.current || containerRef.current?.scrollTop !== 0) return;
    
    const currentY = e.touches[0].clientY;
    const distance = currentY - touchStartY.current;
    
    if (distance > 0) {
      setPullDistance(Math.min(distance, PULL_THRESHOLD * 1.5));
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
      await handleRefresh();
    }
    setPullDistance(0);
    isPulling.current = false;
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  if (isLoading) {
    return (
      <div className="h-screen w-full overflow-hidden bg-black">
        <VideoSkeleton />
        <BottomNav />
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center pb-24">
        <div className="text-center">
          <h2 className="text-2xl font-black mb-2">No videos yet!</h2>
          <p className="text-muted-foreground">Check back later for amazing animations</p>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="h-screen w-full overflow-y-scroll snap-y snap-mandatory bg-black scrollbar-hide"
      style={{ 
        scrollSnapType: 'y mandatory',
        WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'contain'
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull to refresh indicator */}
      {pullDistance > 0 && (
        <div 
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center bg-black/80 transition-all"
          style={{ height: pullDistance }}
        >
          <RefreshCw 
            className={`h-6 w-6 text-white transition-transform ${
              pullDistance >= PULL_THRESHOLD ? 'rotate-180' : ''
            } ${isRefreshing ? 'animate-spin' : ''}`}
          />
        </div>
      )}

      {/* Logo in top left */}
      <div className="fixed top-4 left-3 z-30">
        <img src={toonreelsLogo} alt="ToonReels" className="h-10 w-auto drop-shadow-lg" />
      </div>

      {videos.map((video, index) => (
        <VideoPlayer
          key={video.id}
          video={video}
          currentUserId={currentUserId}
          isPremium={isPremium}
          isActive={index === activeIndex}
          onCommentsClick={() => setSelectedVideoId(video.id)}
          onDelete={video.creator_id === currentUserId ? () => handleDeleteVideo(video.id) : undefined}
        />
      ))}
      
      <CommentsSheet
        videoId={selectedVideoId || ''}
        isOpen={!!selectedVideoId}
        onClose={() => setSelectedVideoId(null)}
        currentUserId={currentUserId}
      />
      
      <BottomNav />
    </div>
  );
};

export default Feed;