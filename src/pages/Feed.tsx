import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import VideoPlayer from '@/components/VideoPlayer';
import VideoSkeleton from '@/components/VideoSkeleton';
import CommentsSheet from '@/components/CommentsSheet';
import BottomNav from '@/components/BottomNav';
import { toast } from 'sonner';
import { RefreshCw, Loader2 } from 'lucide-react';

import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useSoundEffects } from '@/hooks/useSoundEffects';

interface Video {
  id: string;
  video_url: string;
  title: string;
  description: string;
  creator_id: string;
  likes_count: number;
  views_count: number;
  tags?: string[] | null;
  profiles: {
    username: string;
    avatar_url: string;
    is_verified: boolean;
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

const PAGE_SIZE = 10;

const Feed = () => {
  const navigate = useNavigate();
  const { triggerScrollHaptic } = useHapticFeedback();
  const { playSwipeSound, initAudio } = useSoundEffects();
  const [videos, setVideos] = useState<Video[]>([]);
  const [currentUserId, setCurrentUserId] = useState('');
  const [isPremium, setIsPremium] = useState(false);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const touchStartX = useRef(0);
  const touchStartTime = useRef(0);
  const isPulling = useRef(false);
  const isSwipingVertically = useRef(false);
  const preloadedVideosRef = useRef<Set<string>>(new Set());

  const PULL_THRESHOLD = 80;
  const SWIPE_THRESHOLD = 50;
  const SWIPE_VELOCITY_THRESHOLD = 0.3;

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
    
    // Fetch user profile in parallel
    fetchUserProfile(session.user.id);
    
    // Fetch first page of videos
    await fetchVideos(0, true);
    setIsLoading(false);
  };

  const fetchVideos = async (pageNum: number, reset: boolean = false) => {
    const from = pageNum * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    
    const { data, error } = await supabase
      .from('videos')
      .select(`
        *,
        profiles(username, avatar_url, is_verified)
      `)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('Error fetching videos:', error);
      return;
    }

    const newVideos = data || [];
    
    if (newVideos.length < PAGE_SIZE) {
      setHasMore(false);
    }

    // Shuffle videos for variety
    const shuffledVideos = shuffleArray(newVideos);
    
    if (reset) {
      setVideos(shuffledVideos);
      setPage(0);
      setHasMore(newVideos.length === PAGE_SIZE);
    } else {
      setVideos(prev => [...prev, ...shuffledVideos]);
    }
  };

  const fetchUserProfile = async (userId: string) => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_premium')
      .eq('id', userId)
      .maybeSingle();
    
    setIsPremium(profile?.is_premium || false);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setActiveIndex(0);
    setPage(0);
    setHasMore(true);
    await fetchVideos(0, true);
    setIsRefreshing(false);
    toast.success('Feed refreshed!');
    
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const loadMoreVideos = async () => {
    if (isLoadingMore || !hasMore) return;
    
    setIsLoadingMore(true);
    const nextPage = page + 1;
    await fetchVideos(nextPage, false);
    setPage(nextPage);
    setIsLoadingMore(false);
  };

  const handleDeleteVideo = async (videoId: string) => {
    if (confirm('Are you sure you want to delete this video?')) {
      try {
        await supabase.from('videos').delete().eq('id', videoId);
        toast.success('Video deleted');
        setVideos(prev => prev.filter(v => v.id !== videoId));
      } catch (error) {
        toast.error('Failed to delete video');
      }
    }
  };

  // Preload video URLs for smoother playback
  const preloadVideo = useCallback((videoUrl: string) => {
    if (preloadedVideosRef.current.has(videoUrl)) return;
    
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'video';
    link.href = videoUrl;
    document.head.appendChild(link);
    
    preloadedVideosRef.current.add(videoUrl);
    
    // Cleanup old preloads to avoid memory issues
    if (preloadedVideosRef.current.size > 10) {
      const firstKey = preloadedVideosRef.current.values().next().value;
      preloadedVideosRef.current.delete(firstKey);
    }
  }, []);

  // Handle scroll snap to detect active video and load more
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const scrollTop = containerRef.current.scrollTop;
    const height = window.innerHeight;
    const newIndex = Math.round(scrollTop / height);
    
    if (newIndex !== activeIndex && newIndex >= 0 && newIndex < videos.length) {
      // Haptic feedback when snapping to new video
      triggerScrollHaptic();
      setActiveIndex(newIndex);
      
      // Preload next and previous videos
      if (videos[newIndex + 1]) {
        preloadVideo(videos[newIndex + 1].video_url);
      }
      if (videos[newIndex + 2]) {
        preloadVideo(videos[newIndex + 2].video_url);
      }
    }
    
    // Load more when near the end (3 videos before last)
    if (newIndex >= videos.length - 3 && hasMore && !isLoadingMore) {
      loadMoreVideos();
    }
  }, [activeIndex, videos, hasMore, isLoadingMore, triggerScrollHaptic, preloadVideo]);

  // Swipe gesture handlers with acceleration
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartY.current = touch.clientY;
    touchStartX.current = touch.clientX;
    touchStartTime.current = Date.now();
    isSwipingVertically.current = false;
    
    // Initialize audio on first touch
    initAudio();
    
    // Check for pull to refresh
    if (containerRef.current?.scrollTop === 0) {
      isPulling.current = true;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    const deltaY = touch.clientY - touchStartY.current;
    const deltaX = Math.abs(touch.clientX - touchStartX.current);
    
    // Determine swipe direction on first significant move
    if (!isSwipingVertically.current && Math.abs(deltaY) > 10) {
      isSwipingVertically.current = Math.abs(deltaY) > deltaX;
    }
    
    // Handle pull to refresh only at top
    if (isPulling.current && containerRef.current?.scrollTop === 0 && deltaY > 0) {
      setPullDistance(Math.min(deltaY, PULL_THRESHOLD * 1.5));
    }
  };

  const handleTouchEnd = async (e: React.TouchEvent) => {
    const touch = e.changedTouches[0];
    const deltaY = touchStartY.current - touch.clientY;
    const deltaTime = Date.now() - touchStartTime.current;
    const velocity = Math.abs(deltaY) / deltaTime;
    
    // Handle pull to refresh
    if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
      await handleRefresh();
    }
    setPullDistance(0);
    isPulling.current = false;
    
    // Handle fast swipe gestures for video navigation
    if (isSwipingVertically.current && velocity > SWIPE_VELOCITY_THRESHOLD) {
      const container = containerRef.current;
      if (!container) return;
      
      if (deltaY > SWIPE_THRESHOLD && activeIndex < videos.length - 1) {
        // Swipe up - next video with acceleration
        const targetIndex = activeIndex + 1;
        container.scrollTo({
          top: targetIndex * window.innerHeight,
          behavior: 'smooth'
        });
        triggerScrollHaptic();
        playSwipeSound();
      } else if (deltaY < -SWIPE_THRESHOLD && activeIndex > 0) {
        // Swipe down - previous video with acceleration
        const targetIndex = activeIndex - 1;
        container.scrollTo({
          top: targetIndex * window.innerHeight,
          behavior: 'smooth'
        });
        triggerScrollHaptic();
        playSwipeSound();
      }
    }
    
    isSwipingVertically.current = false;
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
      className="h-screen w-full overflow-y-scroll bg-black scrollbar-hide"
      style={{ 
        scrollSnapType: 'y mandatory',
        scrollSnapStop: 'always',
        WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'none'
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


      {videos.map((video, index) => (
        <div 
          key={video.id} 
          className="h-screen w-full flex-shrink-0"
          style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
        >
          <VideoPlayer
            video={video}
            currentUserId={currentUserId}
            isPremium={isPremium}
            isActive={index === activeIndex}
            onCommentsClick={() => setSelectedVideoId(video.id)}
            onDelete={video.creator_id === currentUserId ? () => handleDeleteVideo(video.id) : undefined}
          />
        </div>
      ))}
      
      {/* Loading more indicator */}
      {isLoadingMore && (
        <div className="h-screen w-full flex items-center justify-center bg-black snap-start">
          <Loader2 className="h-8 w-8 text-white animate-spin" />
        </div>
      )}
      
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
