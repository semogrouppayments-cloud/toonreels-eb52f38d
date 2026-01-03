import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Heart, MessageCircle, Download, Flag, Trash2, Volume2, VolumeX, Bookmark, BookmarkCheck, Play, Settings, Repeat, Maximize, Minimize } from 'lucide-react';
import { toast } from 'sonner';
import { useSignedVideoUrl } from '@/hooks/useSignedVideoUrl';
import LikeAnimation from '@/components/LikeAnimation';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import DownloadQualityDialog from '@/components/DownloadQualityDialog';
import DownloadProgressOverlay from '@/components/DownloadProgressOverlay';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useFullscreen } from '@/hooks/useFullscreen';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { addWatermarkToVideo, WatermarkController } from '@/lib/videoWatermark';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
      is_verified: boolean;
    };
  };
  currentUserId: string;
  isPremium: boolean;
  isActive: boolean;
  onCommentsClick: () => void;
  onDelete?: () => void;
  onPositiveAction?: () => void;
}

const VideoPlayer = ({ video, currentUserId, isPremium, isActive, onCommentsClick, onDelete, onPositiveAction }: VideoPlayerProps) => {
  const navigate = useNavigate();
  const { triggerLikeHaptic, triggerHaptic } = useHapticFeedback();
  const { playLikeSound, playTapSound, playSuccessSound } = useSoundEffects();
  const { isFullscreen, toggleFullscreen } = useFullscreen();
  const isMobile = useIsMobile();
  const [isExpanded, setIsExpanded] = useState(false);
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
  const [bufferedPercent, setBufferedPercent] = useState(0);
  const [videoQuality, setVideoQuality] = useState<'HD' | 'SD'>('HD');
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [isLooping, setIsLooping] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadStage, setDownloadStage] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const downloadControllerRef = useRef<WatermarkController | null>(null);
  
  const { signedUrl, loading, error } = useSignedVideoUrl(video.video_url);
  const lastTapRef = useRef<number>(0);
  const animationIdRef = useRef<number>(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const watchStartTimeRef = useRef<number>(Date.now());
  const analyticsTrackedRef = useRef<boolean>(false);
  const hasTrackedViewRef = useRef<boolean>(false);
  const playAttemptRef = useRef<number>(0);
  const touchStartXRef = useRef<number>(0);
  const touchStartYRef = useRef<number>(0);

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

    // Immediately pause non-active videos
    if (!isActive) {
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

    // Video is active - attempt to play
    const attemptPlay = async () => {
      playAttemptRef.current++;
      const currentAttempt = playAttemptRef.current;
      
      try {
        // Reset video position for fresh start
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
        if (currentAttempt === playAttemptRef.current) {
          setTimeout(() => {
            if (videoEl && currentAttempt === playAttemptRef.current && isActive) {
              videoEl.muted = false;
              setIsMuted(false);
            }
          }, 100);
        }
      } catch (err) {
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
    const handleProgress = () => {
      if (videoEl.buffered.length > 0 && videoEl.duration > 0) {
        const bufferedEnd = videoEl.buffered.end(videoEl.buffered.length - 1);
        setBufferedPercent((bufferedEnd / videoEl.duration) * 100);
      }
    };

    videoEl.addEventListener('waiting', handleWaiting);
    videoEl.addEventListener('playing', handlePlaying);
    videoEl.addEventListener('canplay', handleCanPlay);
    videoEl.addEventListener('stalled', handleStalled);
    videoEl.addEventListener('error', handleError);
    videoEl.addEventListener('timeupdate', handleTimeUpdate);
    videoEl.addEventListener('loadedmetadata', handleLoadedMetadata);
    videoEl.addEventListener('durationchange', handleDurationChange);
    videoEl.addEventListener('progress', handleProgress);

    return () => {
      videoEl.removeEventListener('waiting', handleWaiting);
      videoEl.removeEventListener('playing', handlePlaying);
      videoEl.removeEventListener('canplay', handleCanPlay);
      videoEl.removeEventListener('stalled', handleStalled);
      videoEl.removeEventListener('error', handleError);
      videoEl.removeEventListener('timeupdate', handleTimeUpdate);
      videoEl.removeEventListener('loadedmetadata', handleLoadedMetadata);
      videoEl.removeEventListener('durationchange', handleDurationChange);
      videoEl.removeEventListener('progress', handleProgress);
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
      // Use atomic RPC function to prevent race conditions
      await supabase.rpc('increment_video_views', { _video_id: video.id });
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
    triggerHaptic('medium');
    if (!currentUserId) {
      toast.error('Please sign in to like videos');
      return;
    }

    const nextLiked = !liked;
    const nextCount = Math.max(0, likesCount + (nextLiked ? 1 : -1));

    // Optimistic UI (instant feedback)
    setLiked(nextLiked);
    setLikesCount(nextCount);

    try {
      // Just insert/delete the like - database trigger handles counter atomically
      if (nextLiked) {
        await supabase.from('likes').insert({ video_id: video.id, user_id: currentUserId });
        // Track positive action for rating prompt
        onPositiveAction?.();
      } else {
        await supabase.from('likes').delete().match({ video_id: video.id, user_id: currentUserId });
      }
      // Counter is now updated atomically via database trigger (update_video_likes_count)
    } catch (error) {
      // Rollback
      setLiked(liked);
      setLikesCount(likesCount);
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

  // Swipe left to navigate to creator profile
  const handleSwipeStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleSwipeEnd = (e: React.TouchEvent) => {
    const deltaX = touchStartXRef.current - e.changedTouches[0].clientX;
    const deltaY = Math.abs(touchStartYRef.current - e.changedTouches[0].clientY);
    
    // Only trigger horizontal swipe if it's more horizontal than vertical
    if (Math.abs(deltaX) > 80 && deltaY < 50) {
      if (deltaX > 0) {
        // Swipe left - go to creator profile
        triggerHaptic('medium');
        navigate(`/profile?userId=${video.creator_id}`);
      }
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
    toast.success(`Video quality set to ${quality}`);
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
    toast.success(`Playback speed: ${speed}x`);
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic('medium');
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
    triggerHaptic('light');
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

  const handleDownloadWithQuality = async (quality: string, skipWatermark: boolean) => {
    setIsDownloading(true);
    setDownloadProgress(0);
    setDownloadStage('Preparing download...');
    
    try {
      // Use the secure Edge Function to get signed URL and log download
      const { data, error: functionError } = await supabase.functions.invoke('download-video', {
        body: { video_id: video.id }
      });
      
      if (functionError) {
        throw new Error(functionError.message || 'Download failed');
      }
      
      if (!data?.download_url) {
        throw new Error('No download URL received');
      }
      
      setDownloadStage('Downloading video...');
      setDownloadProgress(10);
      
      // Download the video
      const response = await fetch(data.download_url);
      if (!response.ok) throw new Error('Failed to fetch video');
      
      setDownloadProgress(30);
      const videoBlob = await response.blob();
      setDownloadProgress(50);
      
      let finalBlob: Blob;
      let fileExtension: string;
      
      // Skip watermark for premium users who selected the option
      if (skipWatermark && isPremium) {
        setDownloadStage('Preparing file...');
        setDownloadProgress(90);
        finalBlob = videoBlob;
        fileExtension = 'mp4';
      } else {
        setDownloadStage('Adding ToonReels watermark...');
        
        // Apply watermark client-side using Canvas API with cancellation support
        const controller = addWatermarkToVideo(
          videoBlob, 
          data.creator_username || 'ToonReels',
          (progress) => {
            setDownloadProgress(50 + Math.floor(progress * 0.45)); // 50-95%
          }
        );
        
        downloadControllerRef.current = controller;
        finalBlob = await controller.promise;
        fileExtension = 'webm';
      }
      
      setDownloadProgress(100);
      setDownloadStage('Complete!');
      
      // Create download link
      const url = URL.createObjectURL(finalBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${data.title || video.title}_ToonReels.${fileExtension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      // Haptic feedback and sound on successful download
      triggerHaptic('heavy');
      playSuccessSound();
      
      toast.success(skipWatermark ? 'Downloaded successfully!' : 'Downloaded with ToonReels watermark!');
    } catch (error) {
      if ((error as Error).message === 'Download cancelled') {
        toast.info('Download cancelled');
      } else {
        console.error('Download error:', error);
        toast.error('Failed to download video');
      }
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
      downloadControllerRef.current = null;
    }
  };

  const handleCancelDownload = () => {
    if (downloadControllerRef.current) {
      downloadControllerRef.current.cancel();
    }
    setIsDownloading(false);
    setDownloadProgress(0);
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

  const handleDeleteVideo = async () => {
    try {
      const deleteToast = toast.loading('Deleting video...');
      
      const { error } = await supabase
        .from('videos')
        .delete()
        .eq('id', video.id);
      
      if (error) throw error;
      
      toast.success('Video deleted successfully!', { id: deleteToast });
      setShowDeleteDialog(false);
      
      // Call the onDelete callback to update parent state
      if (onDelete) {
        onDelete();
      }
    } catch (error) {
      console.error('Error deleting video:', error);
      toast.error('Failed to delete video');
    }
  };

  const handleActionClick = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    action();
  };

  return (
    <>
      {/* Fullscreen backdrop for desktop/tablet */}
      {isFullscreen && !isMobile && (
        <div 
          className="fixed inset-0 z-40 fullscreen-backdrop"
          onClick={() => toggleFullscreen()}
        />
      )}
      
      <div 
        className={`relative w-full bg-black snap-start snap-always ${
          isFullscreen && !isMobile 
            ? 'fixed inset-4 z-50 rounded-3xl overflow-hidden shadow-2xl border border-white/10' 
            : ''
        }`}
        style={{ 
          height: isFullscreen && !isMobile ? 'calc(100vh - 32px)' : '100vh', 
          scrollSnapAlign: 'start',
          width: isFullscreen && !isMobile ? 'calc(100vw - 32px)' : '100%',
        }}
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
      
      {/* Video container with tap handler and swipe gestures */}
      <div 
        className={`absolute inset-0 flex items-center justify-center ${
          isFullscreen && !isMobile ? 'rounded-3xl overflow-hidden' : ''
        }`}
        onClick={handleTap}
        onTouchStart={handleSwipeStart}
        onTouchEnd={handleSwipeEnd}
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
            className={`w-full h-full object-contain ${
              isFullscreen && !isMobile ? 'rounded-3xl' : ''
            }`}
            loop={isLooping}
            muted={isMuted}
            playsInline
            webkit-playsinline="true"
            x5-playsinline="true"
            preload="metadata"
            crossOrigin="anonymous"
            style={{ 
              maxHeight: isFullscreen && !isMobile ? '100%' : 'calc(100vh - 80px)',
              marginBottom: isFullscreen && !isMobile ? '0' : '80px'
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
      
      {/* ToonReels Branding - Top Left */}
      <div className="absolute top-12 left-3 z-20">
        <span className="text-white/40 text-xl font-bold tracking-wide">ToonReels</span>
      </div>
      
      {/* Top Controls - aligned with ToonReels branding */}
      <div className="absolute top-12 right-3 z-20 flex items-center gap-2">
        {/* Settings (Quality & Speed) */}
        <DropdownMenu open={showSettingsMenu} onOpenChange={setShowSettingsMenu}>
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
          <DropdownMenuContent align="end" className="min-w-[140px] bg-background z-50" onClick={(e) => e.stopPropagation()}>
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Quality</div>
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
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-2">Speed</div>
            {[0.5, 1, 1.5, 2].map((speed) => (
              <DropdownMenuItem 
                key={speed}
                onClick={() => handleSpeedChange(speed)}
                className={playbackSpeed === speed ? 'bg-primary/10 text-primary' : ''}
              >
                {speed}x {speed === 1 && '(Normal)'}
              </DropdownMenuItem>
            ))}
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-2">Loop</div>
            <DropdownMenuItem 
              onClick={() => {
                setIsLooping(!isLooping);
                toast.success(isLooping ? 'Loop disabled' : 'Loop enabled');
              }}
              className="flex items-center gap-2"
            >
              <Repeat className={`h-4 w-4 ${isLooping ? 'text-primary' : ''}`} />
              {isLooping ? 'Disable Loop' : 'Enable Loop'}
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
        style={{ bottom: '110px' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white/80 font-medium min-w-[32px]">
            {formatTime(currentTime)}
          </span>
          <div
            ref={progressBarRef}
            className="flex-1 h-1 bg-white/20 rounded-full cursor-pointer relative group"
            onClick={handleProgressBarClick}
            onTouchStart={handleProgressBarClick}
          >
            {/* Buffered progress */}
            <div 
              className="absolute inset-0 h-full bg-white/40 rounded-full"
              style={{ width: `${bufferedPercent}%` }}
            />
            {/* Playback progress */}
            <div 
              className="absolute inset-0 h-full bg-primary rounded-full transition-all duration-100"
              style={{ width: `${progressPercent}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg" />
            </div>
          </div>
          <span className="text-[10px] text-white/80 font-medium min-w-[32px] text-right">
            {formatTime(duration)}
          </span>
          {/* Fullscreen button for PC/Tablet */}
          {!isMobile && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFullscreen();
              }}
              className="ml-2 p-1 rounded-full bg-black/40 hover:bg-black/60 transition-colors"
            >
              {isFullscreen ? (
                <Minimize className="h-4 w-4 text-white" />
              ) : (
                <Maximize className="h-4 w-4 text-white" />
              )}
            </button>
          )}
        </div>
      </div>
      
      {/* Video Info */}
      <div className="absolute left-2 right-14 text-white z-10" style={{ bottom: '150px' }}>
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
            {video.profiles.is_verified && video.profiles.username === 'ToonReelsOff' ? (
              <span className="bg-gradient-to-r from-yellow-400 to-blue-500 text-white text-[8px] px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5 shadow-lg">
                ⭐
              </span>
            ) : video.profiles.is_verified && (
              <span className="bg-yellow-400 text-black text-[8px] px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                ✓
              </span>
            )}
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
        <p 
          className={`text-[11px] opacity-90 leading-tight mb-0.5 cursor-pointer ${!isExpanded ? 'line-clamp-1' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
        >
          {video.description || video.title}
        </p>
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

      {/* Action Buttons */}
      <div className="absolute right-1 flex flex-col gap-2 z-10" style={{ bottom: '150px' }}>
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
        {isOwnVideo && (
          <button
            onClick={(e) => handleActionClick(e, () => setShowDeleteDialog(true))}
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your video
              and remove it from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteVideo}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Download Quality Dialog */}
      <DownloadQualityDialog
        open={showDownloadDialog}
        onOpenChange={setShowDownloadDialog}
        onSelectQuality={handleDownloadWithQuality}
        videoTitle={video.title}
        isPremium={isPremium}
      />

      {/* Download Progress Overlay */}
      {isDownloading && (
        <DownloadProgressOverlay
          progress={downloadProgress}
          stage={downloadStage}
          onCancel={handleCancelDownload}
        />
      )}
    </div>
    </>
  );
};

export default VideoPlayer;
