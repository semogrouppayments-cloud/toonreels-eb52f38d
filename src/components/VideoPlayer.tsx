import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Heart, MessageCircle, Download, Flag, Trash2, Volume2, VolumeX, Bookmark, BookmarkCheck, Play, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { useSignedVideoUrl } from '@/hooks/useSignedVideoUrl';
import LikeAnimation from '@/components/LikeAnimation';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import DownloadQualityDialog from '@/components/DownloadQualityDialog';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface VideoPlayerProps {
  video: {
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
    };
  };
  currentUserId: string;
  isPremium: boolean;
  isActive: boolean;
  onCommentsClick: () => void;
  onDelete?: () => void;
}

const VideoPlayer = ({ video, currentUserId, isPremium, isActive, onCommentsClick, onDelete }: VideoPlayerProps) => {
  const navigate = useNavigate();
  const { triggerLikeHaptic } = useHapticFeedback();
  const { playLikeSound, playTapSound } = useSoundEffects();
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(video.likes_count);
  const [commentsCount, setCommentsCount] = useState(0);
  const [savesCount, setSavesCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showDownloadDialog, setShowDownloadDialog] = useState(false);
  const [likeAnimations, setLikeAnimations] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [videoQuality, setVideoQuality] = useState<'HD' | 'SD'>('HD');
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const { signedUrl, loading, error } = useSignedVideoUrl(video.video_url);
  const lastTapRef = useRef<number>(0);
  const animationIdRef = useRef<number>(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const watchStartTimeRef = useRef<number>(Date.now());
  const analyticsTrackedRef = useRef<boolean>(false);
  const hasTrackedViewRef = useRef<boolean>(false);
  const playAttemptRef = useRef<number>(0);

  const isOwnVideo = currentUserId === video.creator_id;

  // Initial data fetch
  useEffect(() => {
    checkIfFollowing();
    checkIfLiked();
    checkIfSaved();
    fetchCommentsCount();
    fetchSavesCount();
  }, [video.id, currentUserId]);

  const fetchCommentsCount = async () => {
    const { count } = await supabase
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .eq('video_id', video.id);
    setCommentsCount(count || 0);
  };

  const fetchSavesCount = async () => {
    const { count } = await supabase
      .from('saved_videos')
      .select('*', { count: 'exact', head: true })
      .eq('video_id', video.id);
    setSavesCount(count || 0);
  };

  // Handle active state - play/pause based on visibility with better mobile support
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    const attemptPlay = async () => {
      if (!isActive) {
        // Video is not active - pause and mute
        videoEl.pause();
        videoEl.muted = true;
        setIsMuted(true);
        setIsPlaying(false);
        // Track analytics when leaving
        if (!analyticsTrackedRef.current && hasTrackedViewRef.current) {
          trackVideoAnalytics(false);
        }
        return;
      }

      // Video is now active - prepare and play
      playAttemptRef.current++;
      const currentAttempt = playAttemptRef.current;
      
      try {
        // Reset video position
        videoEl.currentTime = 0;
        
        // First try to play muted (always works on mobile)
        videoEl.muted = true;
        setIsMuted(true);
        
        await videoEl.play();
        setIsPlaying(true);
        
        // Track view only once per video
        if (!hasTrackedViewRef.current) {
          incrementViewCount();
          hasTrackedViewRef.current = true;
          watchStartTimeRef.current = Date.now();
          analyticsTrackedRef.current = false;
        }
        
        // After successful muted play, try to unmute
        // Only if this is still the current attempt
        if (currentAttempt === playAttemptRef.current) {
          setTimeout(() => {
            if (videoEl && currentAttempt === playAttemptRef.current) {
              videoEl.muted = false;
              setIsMuted(false);
            }
          }, 100);
        }
      } catch (err) {
        // Playback failed - likely user hasn't interacted yet
        console.log('Autoplay failed, waiting for user interaction');
        setIsPlaying(false);
      }
    };

    attemptPlay();
  }, [isActive, signedUrl]);

  // Handle video events for better mobile playback
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    const handleWaiting = () => setIsBuffering(true);
    const handlePlaying = () => setIsBuffering(false);
    const handleCanPlay = () => setIsBuffering(false);
    const handleStalled = () => {
      // Video stalled - try to recover
      if (isActive && videoEl.paused) {
        videoEl.play().catch(() => {});
      }
    };
    const handleError = () => {
      // On error, try reloading the video
      if (signedUrl && isActive) {
        videoEl.load();
        videoEl.play().catch(() => {});
      }
    };

    const handleTimeUpdate = () => setCurrentTime(videoEl.currentTime);
    const handleLoadedMetadata = () => setDuration(videoEl.duration);
    const handleDurationChange = () => setDuration(videoEl.duration);

    videoEl.addEventListener('waiting', handleWaiting);
    videoEl.addEventListener('playing', handlePlaying);
    videoEl.addEventListener('canplay', handleCanPlay);
    videoEl.addEventListener('stalled', handleStalled);
    videoEl.addEventListener('error', handleError);
    videoEl.addEventListener('timeupdate', handleTimeUpdate);
    videoEl.addEventListener('loadedmetadata', handleLoadedMetadata);
    videoEl.addEventListener('durationchange', handleDurationChange);

    return () => {
      videoEl.removeEventListener('waiting', handleWaiting);
      videoEl.removeEventListener('playing', handlePlaying);
      videoEl.removeEventListener('canplay', handleCanPlay);
      videoEl.removeEventListener('stalled', handleStalled);
      videoEl.removeEventListener('error', handleError);
      videoEl.removeEventListener('timeupdate', handleTimeUpdate);
      videoEl.removeEventListener('loadedmetadata', handleLoadedMetadata);
      videoEl.removeEventListener('durationchange', handleDurationChange);
    };
  }, [isActive, signedUrl]);

  // Reset tracking when video changes
  useEffect(() => {
    hasTrackedViewRef.current = false;
    analyticsTrackedRef.current = false;
    playAttemptRef.current = 0;
  }, [video.id]);

  const checkIfLiked = async () => {
    if (!currentUserId) return;
    
    const { data } = await supabase
      .from('likes')
      .select('id')
      .eq('video_id', video.id)
      .eq('user_id', currentUserId)
      .maybeSingle();
    
    setLiked(!!data);
  };

  const checkIfSaved = async () => {
    if (!currentUserId) return;
    
    const { data } = await supabase
      .from('saved_videos')
      .select('id')
      .eq('video_id', video.id)
      .eq('user_id', currentUserId)
      .maybeSingle();
    
    setIsSaved(!!data);
  };

  const incrementViewCount = async () => {
    try {
      const { data: currentVideo } = await supabase
        .from('videos')
        .select('views_count')
        .eq('id', video.id)
        .single();
      
      if (currentVideo) {
        await supabase
          .from('videos')
          .update({ views_count: currentVideo.views_count + 1 })
          .eq('id', video.id);
      }
    } catch (error) {
      console.error('Failed to increment view count:', error);
    }
  };

  const trackVideoAnalytics = async (completed: boolean) => {
    if (analyticsTrackedRef.current) return;
    analyticsTrackedRef.current = true;

    const watchDuration = Math.floor((Date.now() - watchStartTimeRef.current) / 1000);
    
    if (watchDuration < 1) return;

    try {
      await supabase.from('video_analytics').insert({
        video_id: video.id,
        viewer_id: currentUserId || null,
        watch_duration: watchDuration,
        completed: completed,
        device_type: /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
      });
    } catch (error) {
      console.error('Failed to track analytics:', error);
    }
  };

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const handleEnded = () => {
      trackVideoAnalytics(true);
    };

    videoElement.addEventListener('ended', handleEnded);
    return () => videoElement.removeEventListener('ended', handleEnded);
  }, [video.id]);

  const checkIfFollowing = async () => {
    if (!currentUserId || currentUserId === video.creator_id) return;
    
    const { data } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', currentUserId)
      .eq('following_id', video.creator_id)
      .maybeSingle();
    
    setIsFollowing(!!data);
  };

  const handleLike = async () => {
    try {
      if (liked) {
        await supabase.from('likes').delete().match({ video_id: video.id, user_id: currentUserId });
        setLikesCount(prev => prev - 1);
        
        const { data: currentVideo } = await supabase
          .from('videos')
          .select('likes_count')
          .eq('id', video.id)
          .single();
        
        if (currentVideo) {
          await supabase
            .from('videos')
            .update({ likes_count: Math.max(0, currentVideo.likes_count - 1) })
            .eq('id', video.id);
        }
      } else {
        await supabase.from('likes').insert({ video_id: video.id, user_id: currentUserId });
        setLikesCount(prev => prev + 1);
        
        const { data: currentVideo } = await supabase
          .from('videos')
          .select('likes_count')
          .eq('id', video.id)
          .single();
        
        if (currentVideo) {
          await supabase
            .from('videos')
            .update({ likes_count: currentVideo.likes_count + 1 })
            .eq('id', video.id);
        }
      }
      setLiked(!liked);
    } catch (error) {
      toast.error('Failed to like video');
    }
  };

  const handleTap = (e: React.TouchEvent | React.MouseEvent) => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;

    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      // Double tap - like with haptic and sound feedback
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = 'touches' in e ? e.changedTouches[0]?.clientX || 0 : e.clientX;
      const y = 'touches' in e ? e.changedTouches[0]?.clientY || 0 : e.clientY;
      
      const id = animationIdRef.current++;
      setLikeAnimations(prev => [...prev, { id, x, y }]);
      
      // Trigger haptic and sound feedback on like
      triggerLikeHaptic();
      playLikeSound();
      
      if (!liked) {
        handleLike();
      }
      lastTapRef.current = 0; // Reset to prevent triple tap
    } else {
      // Single tap - toggle play/pause with subtle feedback
      lastTapRef.current = now;
      setTimeout(() => {
        if (lastTapRef.current === now) {
          playTapSound();
          togglePlayPause();
        }
      }, DOUBLE_TAP_DELAY);
    }
  };

  const togglePlayPause = () => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (isPlaying) {
      videoEl.pause();
      setIsPlaying(false);
    } else {
      videoEl.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const removeAnimation = (id: number) => {
    setLikeAnimations(prev => prev.filter(anim => anim.id !== id));
  };

  const handleProgressBarClick = useCallback((e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const progressBar = progressBarRef.current;
    const videoEl = videoRef.current;
    if (!progressBar || !videoEl || !duration) return;

    const rect = progressBar.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clickPosition = (clientX - rect.left) / rect.width;
    const newTime = clickPosition * duration;
    
    videoEl.currentTime = Math.max(0, Math.min(newTime, duration));
    setCurrentTime(newTime);
  }, [duration]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleQualityChange = (quality: 'HD' | 'SD') => {
    setVideoQuality(quality);
    setShowQualityMenu(false);
    toast.success(`Video quality set to ${quality}`);
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUserId) {
      toast.error('Please sign in to follow creators');
      return;
    }

    try {
      if (isFollowing) {
        await supabase
          .from('follows')
          .delete()
          .eq('follower_id', currentUserId)
          .eq('following_id', video.creator_id);
        setIsFollowing(false);
        toast.success('Unfollowed creator');
      } else {
        await supabase
          .from('follows')
          .insert({ follower_id: currentUserId, following_id: video.creator_id });
        setIsFollowing(true);
        toast.success('Following creator!');
      }
    } catch (error) {
      toast.error('Failed to update follow status');
    }
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUserId) {
      toast.error('Please sign in to save videos');
      return;
    }

    try {
      if (isSaved) {
        await supabase
          .from('saved_videos')
          .delete()
          .eq('user_id', currentUserId)
          .eq('video_id', video.id);
        setIsSaved(false);
        setSavesCount(prev => Math.max(0, prev - 1));
        toast.success('Removed from saved');
      } else {
        await supabase
          .from('saved_videos')
          .insert({ user_id: currentUserId, video_id: video.id });
        setIsSaved(true);
        setSavesCount(prev => prev + 1);
        toast.success('Saved to watch later!');
      }
    } catch (error) {
      toast.error('Failed to save video');
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDownloadDialog(true);
  };

  const handleDownloadWithQuality = async (quality: string) => {
    const downloadToast = toast.loading('Preparing download...');
    
    try {
      const response = await fetch(signedUrl || video.video_url);
      if (!response.ok) throw new Error('Failed to fetch video');
      
      const videoBlob = await response.blob();
      
      const url = URL.createObjectURL(videoBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${video.title}_${quality}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      await supabase.from('video_downloads').insert({
        video_id: video.id,
        user_id: currentUserId
      });
      
      toast.success(`Downloaded in ${quality} quality!`, { id: downloadToast });
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download video', { id: downloadToast });
    }
  };

  const handleReport = async (reason: string) => {
    try {
      await supabase.from('reports').insert({
        reporter_id: currentUserId,
        reported_type: 'video',
        reported_id: video.id,
        reason
      });
      toast.success('Video reported. Thank you for keeping our community safe!');
      setShowReportDialog(false);
    } catch (error) {
      toast.error('Failed to report video');
    }
  };

  const handleActionClick = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    action();
  };

  return (
    <div 
      className="relative w-full bg-black snap-start snap-always"
      style={{ height: '100vh', scrollSnapAlign: 'start' }}
    >
      {/* Like animations */}
      {likeAnimations.map(anim => (
        <LikeAnimation
          key={anim.id}
          x={anim.x}
          y={anim.y}
          onComplete={() => removeAnimation(anim.id)}
        />
      ))}
      
      {/* Video container with tap handler */}
      <div 
        className="absolute inset-0 flex items-center justify-center"
        onClick={handleTap}
      >
        {loading ? (
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-white border-t-transparent" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center">
            <span className="text-white text-sm">Failed to load</span>
          </div>
        ) : (
          <video
            ref={videoRef}
            src={signedUrl || ''}
            className="w-full h-full object-contain"
            loop
            muted={isMuted}
            playsInline
            webkit-playsinline="true"
            x5-playsinline="true"
            preload="metadata"
            style={{ 
              maxHeight: 'calc(100vh - 80px)',
              marginBottom: '80px'
            }}
          />
        )}
        
        {/* Buffering indicator */}
        {isBuffering && isActive && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="animate-spin rounded-full h-10 w-10 border-3 border-white border-t-transparent" />
          </div>
        )}
        
        {/* Play/Pause indicator */}
        {!isPlaying && isActive && !isBuffering && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-black/50 rounded-full p-4">
              <Play className="h-12 w-12 text-white fill-white" />
            </div>
          </div>
        )}
      </div>
      
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
      
      {/* Top Controls */}
      <div className="absolute top-4 right-3 z-20 flex items-center gap-2">
        {/* Quality Selector */}
        <DropdownMenu open={showQualityMenu} onOpenChange={setShowQualityMenu}>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              onClick={(e) => e.stopPropagation()}
              className="rounded-full h-8 w-8 bg-black/40 text-white hover:bg-black/60"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[100px]" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem 
              onClick={() => handleQualityChange('HD')}
              className={videoQuality === 'HD' ? 'bg-primary/10 text-primary' : ''}
            >
              HD (720p+)
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => handleQualityChange('SD')}
              className={videoQuality === 'SD' ? 'bg-primary/10 text-primary' : ''}
            >
              SD (480p)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Volume Control */}
        <Button
          size="icon"
          variant="ghost"
          onClick={toggleMute}
          className="rounded-full h-8 w-8 bg-black/40 text-white hover:bg-black/60"
        >
          {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </Button>
      </div>
      
      {/* Progress Bar */}
      <div 
        className="absolute left-0 right-0 z-20 px-3"
        style={{ bottom: '90px' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white/80 font-medium min-w-[32px]">
            {formatTime(currentTime)}
          </span>
          <div
            ref={progressBarRef}
            className="flex-1 h-1 bg-white/30 rounded-full cursor-pointer relative group"
            onClick={handleProgressBarClick}
            onTouchStart={handleProgressBarClick}
          >
            <div 
              className="h-full bg-primary rounded-full transition-all duration-100 relative"
              style={{ width: `${progressPercent}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg" />
            </div>
          </div>
          <span className="text-[10px] text-white/80 font-medium min-w-[32px] text-right">
            {formatTime(duration)}
          </span>
        </div>
      </div>
      
      {/* Video Info - moved up with bottom padding */}
      <div className="absolute left-2 right-14 text-white z-10" style={{ bottom: '100px' }}>
        <div className="flex items-center gap-1.5 mb-0.5">
          <div 
            className="flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/profile?userId=${video.creator_id}`);
            }}
          >
            <Avatar className="h-6 w-6 border border-white/30">
              <AvatarImage src={video.profiles.avatar_url || undefined} alt={video.profiles.username} />
              <AvatarFallback className="bg-primary text-background text-[10px] font-bold">
                {video.profiles.username[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="font-medium text-xs">{video.profiles.username}</span>
          </div>
          
          {/* Follow/Following button */}
          {currentUserId && !isOwnVideo && (
            <button
              onClick={handleFollow}
              className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                isFollowing 
                  ? 'bg-white/20 text-white' 
                  : 'bg-primary text-primary-foreground'
              }`}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </button>
          )}
        </div>
        <p className="text-[11px] opacity-90 line-clamp-1 leading-tight mb-0.5">{video.description || video.title}</p>
        {/* Hashtags under description */}
        {video.tags && video.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {video.tags.slice(0, 4).map((tag, i) => (
              <span key={i} className="text-[10px] text-primary/90 font-medium">
                #{tag.length > 15 ? tag.slice(0, 15) : tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Action Buttons - moved up */}
      <div className="absolute right-1 flex flex-col gap-2 z-10" style={{ bottom: '100px' }}>
        {/* Like */}
        <button
          onClick={(e) => handleActionClick(e, handleLike)}
          className="flex flex-col items-center"
        >
          <div className={`rounded-full h-9 w-9 flex items-center justify-center ${liked ? 'text-primary' : 'text-white'}`}>
            <Heart className={`h-5 w-5 ${liked ? 'fill-current' : ''}`} />
          </div>
          <span className="text-[9px] text-white font-medium">{likesCount}</span>
        </button>

        {/* Comment */}
        <button
          onClick={(e) => handleActionClick(e, onCommentsClick)}
          className="flex flex-col items-center"
        >
          <div className="rounded-full h-9 w-9 flex items-center justify-center text-white">
            <MessageCircle className="h-5 w-5" />
          </div>
          <span className="text-[9px] text-white font-medium">{commentsCount}</span>
        </button>

        {/* Save - only for non-owners */}
        {!isOwnVideo && (
          <button
            onClick={handleSave}
            className="flex flex-col items-center"
          >
            <div className={`rounded-full h-9 w-9 flex items-center justify-center ${isSaved ? 'text-primary' : 'text-white'}`}>
              {isSaved ? (
                <BookmarkCheck className="h-5 w-5 fill-current" />
              ) : (
                <Bookmark className="h-5 w-5" />
              )}
            </div>
            <span className="text-[9px] text-white font-medium">{savesCount}</span>
          </button>
        )}

        {/* Download - only for non-owners */}
        {!isOwnVideo && (
          <button
            onClick={handleDownload}
            className="flex flex-col items-center"
          >
            <div className="rounded-full h-9 w-9 flex items-center justify-center text-white">
              <Download className="h-5 w-5" />
            </div>
            <span className="text-[9px] text-white font-medium">Download</span>
          </button>
        )}

        {/* Report - only for non-owners */}
        {!isOwnVideo && (
          <button
            onClick={(e) => handleActionClick(e, () => setShowReportDialog(true))}
            className="flex flex-col items-center"
          >
            <div className="rounded-full h-9 w-9 flex items-center justify-center text-white">
              <Flag className="h-5 w-5" />
            </div>
            <span className="text-[9px] text-white font-medium">Report</span>
          </button>
        )}

        {/* Delete - only for owners */}
        {isOwnVideo && onDelete && (
          <button
            onClick={(e) => handleActionClick(e, onDelete)}
            className="flex flex-col items-center"
          >
            <div className="rounded-full h-9 w-9 flex items-center justify-center text-destructive">
              <Trash2 className="h-5 w-5" />
            </div>
            <span className="text-[9px] text-white font-medium">Delete</span>
          </button>
        )}
      </div>

      {/* Report Dialog */}
      {showReportDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowReportDialog(false)}>
          <div className="bg-background rounded-xl p-4 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-4">Report Video</h3>
            <div className="space-y-2">
              {['Inappropriate content', 'Violence or harmful content', 'Spam or misleading', 'Copyright violation', 'Other'].map(reason => (
                <button
                  key={reason}
                  onClick={() => handleReport(reason)}
                  className="w-full text-left px-4 py-3 rounded-lg hover:bg-muted transition-colors text-sm"
                >
                  {reason}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowReportDialog(false)}
              className="w-full mt-4 text-muted-foreground text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Download Quality Dialog */}
      <DownloadQualityDialog
        open={showDownloadDialog}
        onOpenChange={setShowDownloadDialog}
        onSelectQuality={handleDownloadWithQuality}
        videoTitle={video.title}
      />
    </div>
  );
};

export default VideoPlayer;
