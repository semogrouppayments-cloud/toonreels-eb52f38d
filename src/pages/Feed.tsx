import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import VideoPlayer from '@/components/VideoPlayer';
import VideoSkeleton from '@/components/VideoSkeleton';
import CommentsSheet from '@/components/CommentsSheet';
import ResponsiveLayout from '@/components/ResponsiveLayout';
import RatingPrompt from '@/components/RatingPrompt';
import ChangelogModal from '@/components/ChangelogModal';
import ScreenTimeLock from '@/components/ScreenTimeLock';
import { toast } from 'sonner';
import { RefreshCw, Loader2 } from 'lucide-react';

import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { useAppRating } from '@/hooks/useAppRating';
import { useChangelog } from '@/hooks/useChangelog';
import { useScreenTime } from '@/hooks/useScreenTime';

interface SubtitleSegment {
  id: number;
  text: string;
  start: number;
  end: number;
}

interface Video {
  id: string;
  video_url: string;
  title: string;
  description: string;
  creator_id: string;
  likes_count: number;
  views_count: number;
  tags?: string[] | null;
  subtitles?: SubtitleSegment[] | null;
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
  const { showRatingPrompt, trackPositiveAction, handleRateNow, handleRemindLater, handleNoThanks } = useAppRating();
  const { showChangelog, isNewVersion, currentVersion, changelog, markAsSeen } = useChangelog();
  const [videos, setVideos] = useState<Video[]>([]);
  const [currentUserId, setCurrentUserId] = useState('');
  const [isPremium, setIsPremium] = useState(false);
  const [isCreative, setIsCreative] = useState(false);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'forYou' | 'following'>('forYou');
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const touchStartX = useRef(0);
  const touchStartTime = useRef(0);
  const isPulling = useRef(false);
  const isSwipingVertically = useRef(false);
  const preloadedVideosRef = useRef<Set<string>>(new Set());

  // Screen time tracking
  const { isLocked, lockReason, timeUsed, timeLimit, unlock } = useScreenTime(currentUserId);

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
    
    // Check if user is creative
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id);
    setIsCreative(roles?.some(r => r.role === 'creative') || false);
    
    // Fetch user profile, blocked users, and following in parallel
    fetchUserProfile(session.user.id);
    const [blockedIds, followIds] = await Promise.all([
      fetchBlockedUsers(session.user.id),
      fetchFollowingUsers(session.user.id)
    ]);
    
    // Fetch first page of videos
    await fetchVideos(0, true, blockedIds, 'forYou', followIds);
    setIsLoading(false);
  };

  const fetchFollowingUsers = async (userId: string): Promise<string[]> => {
    const { data: follows } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', userId);
    
    const ids = follows?.map(f => f.following_id) || [];
    setFollowingIds(ids);
    return ids;
  };

  const fetchBlockedUsers = async (userId: string): Promise<string[]> => {
    const { data: blocks } = await supabase
      .from('blocks')
      .select('blocked_id')
      .eq('blocker_id', userId);
    
    const ids = blocks?.map(b => b.blocked_id) || [];
    setBlockedUserIds(ids);
    return ids;
  };

  const fetchVideos = async (
    pageNum: number, 
    reset: boolean = false, 
    blockedIds?: string[],
    tab?: 'forYou' | 'following',
    followIds?: string[]
  ) => {
    const from = pageNum * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    
    // Use provided values or fall back to state
    const idsToFilter = blockedIds || blockedUserIds;
    const currentTab = tab || activeTab;
    const currentFollowIds = followIds || followingIds;
    
    let query = supabase
      .from('videos')
      .select(`
        *,
        subtitles,
        profiles(username, avatar_url, is_verified)
      `)
      .order('created_at', { ascending: false })
      .range(from, to);
    
    // Filter out videos from blocked users
    if (idsToFilter.length > 0) {
      query = query.not('creator_id', 'in', `(${idsToFilter.join(',')})`);
    }
    
    // Filter to only following creators for "Following" tab
    if (currentTab === 'following' && currentFollowIds.length > 0) {
      query = query.in('creator_id', currentFollowIds);
    } else if (currentTab === 'following' && currentFollowIds.length === 0) {
      // No following, return empty
      if (reset) {
        setVideos([]);
        setPage(0);
        setHasMore(false);
      }
      return;
    }
    
    const { data, error } = await query;

    if (error) {
      console.error('Error fetching videos:', error);
      return;
    }

    // Transform data to ensure subtitles are properly typed
    const transformedVideos: Video[] = (data || []).map(video => ({
      ...video,
      subtitles: video.subtitles as unknown as SubtitleSegment[] | null
    }));
    
    if (transformedVideos.length < PAGE_SIZE) {
      setHasMore(false);
    }

    // Shuffle videos for variety
    const shuffledVideos = shuffleArray(transformedVideos);
    
    if (reset) {
      setVideos(shuffledVideos);
      setPage(0);
      setHasMore(transformedVideos.length === PAGE_SIZE);
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
      <ResponsiveLayout>
        <div className="h-screen w-full overflow-hidden bg-black">
          <VideoSkeleton />
        </div>
      </ResponsiveLayout>
    );
  }

  const handleTabChange = async (tab: 'forYou' | 'following') => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    setActiveIndex(0);
    setPage(0);
    setHasMore(true);
    setVideos([]);
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0 });
    }
    await fetchVideos(0, true, blockedUserIds, tab, followingIds);
  };

  if (videos.length === 0 && !isLoading) {
    return (
      <ResponsiveLayout>
        <div className="min-h-screen bg-black flex flex-col">
          {/* Tab header */}
          <div className="fixed top-0 left-0 right-0 z-40 flex justify-center gap-6 py-4 bg-gradient-to-b from-black/80 to-transparent md:left-56 lg:left-64">
            <button
              onClick={() => handleTabChange('forYou')}
              className={`text-sm font-semibold transition-colors ${
                activeTab === 'forYou' ? 'text-white' : 'text-white/50'
              }`}
            >
              For You
            </button>
            <button
              onClick={() => handleTabChange('following')}
              className={`text-sm font-semibold transition-colors ${
                activeTab === 'following' ? 'text-white' : 'text-white/50'
              }`}
            >
              Following
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center pb-24">
            <div className="text-center">
              <h2 className="text-2xl font-black mb-2 text-white">
                {activeTab === 'following' ? 'No videos from followed creators' : 'No videos yet!'}
              </h2>
              <p className="text-white/60">
                {activeTab === 'following' 
                  ? 'Follow some creators to see their content here' 
                  : 'Check back later for amazing animations'}
              </p>
            </div>
          </div>
        </div>
      </ResponsiveLayout>
    );
  }

  return (
    <ResponsiveLayout>
      <div 
        ref={containerRef}
        className="h-screen w-full overflow-y-scroll bg-black scrollbar-hide"
        style={{ 
          scrollSnapType: 'y mandatory',
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
          willChange: 'scroll-position',
          transform: 'translateZ(0)',
          backfaceVisibility: 'hidden'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Tab header */}
        <div className="fixed top-0 left-0 right-0 z-40 flex justify-center gap-6 py-4 bg-gradient-to-b from-black/80 to-transparent md:left-56 lg:left-64">
          <button
            onClick={() => handleTabChange('forYou')}
            className={`text-sm font-semibold transition-colors ${
              activeTab === 'forYou' ? 'text-white' : 'text-white/50'
            }`}
          >
            For You
          </button>
          <button
            onClick={() => handleTabChange('following')}
            className={`text-sm font-semibold transition-colors ${
              activeTab === 'following' ? 'text-white' : 'text-white/50'
            }`}
          >
            Following
          </button>
        </div>

        {/* Pull to refresh indicator */}
        {pullDistance > 0 && (
          <div 
            className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center bg-black/80 transition-all md:left-56 lg:left-64"
            style={{ height: pullDistance }}
          >
            <RefreshCw 
              className={`h-6 w-6 text-white transition-transform ${
                pullDistance >= PULL_THRESHOLD ? 'rotate-180' : ''
              } ${isRefreshing ? 'animate-spin' : ''}`}
            />
          </div>
        )}

        {videos.map((video, index) => {
          // Only render videos within a window around the active index for better performance
          const shouldRender = Math.abs(index - activeIndex) <= 2;
          
          return (
            <div 
              key={video.id} 
              className="h-screen w-full flex-shrink-0"
              style={{ 
                scrollSnapAlign: 'start',
                willChange: index === activeIndex ? 'transform' : 'auto',
                transform: 'translateZ(0)',
                contain: 'layout style paint',
                contentVisibility: shouldRender ? 'visible' : 'auto',
                containIntrinsicSize: '0 100vh'
              }}
            >
              {shouldRender ? (
                <VideoPlayer
                  video={video}
                  currentUserId={currentUserId}
                  isPremium={isPremium}
                  isActive={index === activeIndex}
                  onCommentsClick={() => setSelectedVideoId(video.id)}
                  onDelete={video.creator_id === currentUserId ? () => handleDeleteVideo(video.id) : undefined}
                  onPositiveAction={trackPositiveAction}
                />
              ) : (
                // Placeholder for videos outside the render window
                <div className="h-full w-full bg-black flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
                </div>
              )}
            </div>
          );
        })}
        
        {/* Loading more indicator */}
        {isLoadingMore && (
          <div className="h-screen w-full flex items-center justify-center bg-black snap-start">
            <Loader2 className="h-8 w-8 text-white animate-spin" />
          </div>
        )}
        
        <CommentsSheet
          videoId={selectedVideoId || ''}
          isOpen={!!selectedVideoId}
          onClose={() => {
            setSelectedVideoId(null);
            trackPositiveAction();
          }}
          currentUserId={currentUserId}
        />
        
        {/* Rating Prompt */}
        <RatingPrompt
          open={showRatingPrompt}
          onRateNow={handleRateNow}
          onRemindLater={handleRemindLater}
          onNoThanks={handleNoThanks}
        />
        
        {/* Changelog Modal */}
        <ChangelogModal
          open={showChangelog}
          onClose={markAsSeen}
          isNewVersion={isNewVersion}
          currentVersion={currentVersion}
          changelog={changelog}
        />
        
        {/* Screen Time Lock */}
        {isLocked && currentUserId && (
          <ScreenTimeLock
            userId={currentUserId}
            lockReason={lockReason}
            timeUsed={timeUsed}
            timeLimit={timeLimit}
            onUnlock={unlock}
          />
        )}
      </div>
    </ResponsiveLayout>
  );
};

export default Feed;
