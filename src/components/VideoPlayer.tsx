import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Heart, MessageCircle, Download, Flag, Trash2, Volume2, VolumeX, Bookmark, BookmarkCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useSignedVideoUrl } from '@/hooks/useSignedVideoUrl';
import LikeAnimation from '@/components/LikeAnimation';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import DownloadQualityDialog from '@/components/DownloadQualityDialog';

interface VideoPlayerProps {
  video: {
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
  };
  currentUserId: string;
  isPremium: boolean;
  onCommentsClick: () => void;
  onDelete?: () => void;
}

const VideoPlayer = ({ video, currentUserId, isPremium, onCommentsClick, onDelete }: VideoPlayerProps) => {
  const navigate = useNavigate();
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(video.likes_count);
  const [isFollowing, setIsFollowing] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showDownloadDialog, setShowDownloadDialog] = useState(false);
  const [likeAnimations, setLikeAnimations] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const { signedUrl, loading, error } = useSignedVideoUrl(video.video_url);
  const lastTapRef = useRef<number>(0);
  const animationIdRef = useRef<number>(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const watchStartTimeRef = useRef<number>(Date.now());
  const analyticsTrackedRef = useRef<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isOwnVideo = currentUserId === video.creator_id;

  useEffect(() => {
    checkIfFollowing();
    checkIfLiked();
    checkIfSaved();
    incrementViewCount();
    watchStartTimeRef.current = Date.now();
    analyticsTrackedRef.current = false;

    return () => {
      trackVideoAnalytics(false);
    };
  }, [video.id, currentUserId]);

  // Intersection Observer to handle video when scrolled
  useEffect(() => {
    const container = containerRef.current;
    const videoEl = videoRef.current;
    if (!container || !videoEl) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Video is in view - play it
            videoEl.play().catch(() => {
              console.log('Play prevented');
            });
            setIsPlaying(true);
          } else {
            // Video scrolled out of view - mute and pause
            setIsMuted(true);
            videoEl.muted = true;
            videoEl.pause();
            setIsPlaying(false);
          }
        });
      },
      {
        threshold: 0.5,
      }
    );

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, []);

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
      .single();
    
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

  const handleDoubleTap = (e: React.TouchEvent | React.MouseEvent) => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;

    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const y = 'touches' in e ? e.touches[0].clientY : e.clientY;
      
      const id = animationIdRef.current++;
      setLikeAnimations(prev => [...prev, { id, x, y }]);
      
      if (!liked) {
        handleLike();
      }
    } else {
      // Single tap - toggle play/pause
      if (videoRef.current) {
        if (isPlaying) {
          videoRef.current.pause();
          setIsPlaying(false);
        } else {
          videoRef.current.play().catch(() => {});
          setIsPlaying(true);
        }
      }
    }
    
    lastTapRef.current = now;
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const removeAnimation = (id: number) => {
    setLikeAnimations(prev => prev.filter(anim => anim.id !== id));
  };

  const handleFollow = async () => {
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

  const handleSave = async () => {
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
        toast.success('Removed from saved');
      } else {
        await supabase
          .from('saved_videos')
          .insert({ user_id: currentUserId, video_id: video.id });
        setIsSaved(true);
        toast.success('Saved to watch later!');
      }
    } catch (error) {
      toast.error('Failed to save video');
    }
  };

  const handleDownload = () => {
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

  return (
    <div ref={containerRef} className="relative h-screen w-full snap-start bg-black">
      {/* Like animations */}
      {likeAnimations.map(anim => (
        <LikeAnimation
          key={anim.id}
          x={anim.x}
          y={anim.y}
          onComplete={() => removeAnimation(anim.id)}
        />
      ))}
      
      {loading ? (
        <div className="h-full w-full bg-black flex items-center justify-center">
          <span className="text-white text-sm">Loading...</span>
        </div>
      ) : error ? (
        <div className="h-full w-full bg-black flex items-center justify-center">
          <span className="text-white text-sm">Failed to load</span>
        </div>
      ) : (
        <video
          ref={videoRef}
          src={signedUrl || ''}
          className="w-full h-screen object-contain bg-black"
          style={{ objectFit: 'contain' }}
          loop
          autoPlay
          muted={isMuted}
          playsInline
          webkit-playsinline="true"
          preload="auto"
          onTouchStart={handleDoubleTap}
          onDoubleClick={handleDoubleTap}
          onLoadedData={() => {
            if (videoRef.current) {
              videoRef.current.play().catch(() => {
                console.log('Autoplay prevented');
              });
            }
          }}
        />
      )}
      
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
      
      {/* Volume Control - tiny */}
      <Button
        size="icon"
        variant="ghost"
        onClick={toggleMute}
        className="absolute top-3 right-3 z-10 rounded-full h-8 w-8 bg-black/40 text-white hover:bg-black/60"
      >
        {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </Button>
      
      {/* Video Info - compact with follow next to username */}
      <div className="absolute bottom-16 left-2 right-14 text-white">
        <div className="flex items-center gap-1.5 mb-1">
          <div 
            className="flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => navigate(`/profile?userId=${video.creator_id}`)}
          >
            <Avatar className="h-6 w-6 border border-white/30">
              <AvatarImage src={video.profiles.avatar_url || undefined} alt={video.profiles.username} />
              <AvatarFallback className="bg-primary text-background text-[10px] font-bold">
                {video.profiles.username[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="font-medium text-xs">{video.profiles.username}</span>
          </div>
          
          {/* Follow/Following button next to username - only for other users' videos */}
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
        <p className="text-[11px] opacity-90 line-clamp-2 leading-tight">{video.description || video.title}</p>
      </div>

      {/* Action Buttons - tiny and compact */}
      <div className="absolute bottom-16 right-1 flex flex-col gap-2">
        {/* Like - show for everyone */}
        <button
          onClick={handleLike}
          className="flex flex-col items-center"
        >
          <div className={`rounded-full h-9 w-9 flex items-center justify-center ${liked ? 'text-primary' : 'text-white'}`}>
            <Heart className={`h-5 w-5 ${liked ? 'fill-current' : ''}`} />
          </div>
          <span className="text-[9px] text-white font-medium">{likesCount}</span>
        </button>

        {/* Comment - show for everyone */}
        <button
          onClick={onCommentsClick}
          className="flex flex-col items-center"
        >
          <div className="rounded-full h-9 w-9 flex items-center justify-center text-white">
            <MessageCircle className="h-5 w-5" />
          </div>
          <span className="text-[9px] text-white font-medium">Comment</span>
        </button>

        {/* Save - show for viewers (not own video) */}
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
            <span className="text-[9px] text-white font-medium">{isSaved ? 'Saved' : 'Save'}</span>
          </button>
        )}

        {/* Download - show for viewers (not own video) */}
        {!isOwnVideo && (
          <button
            onClick={handleDownload}
            className="flex flex-col items-center"
          >
            <div className="rounded-full h-9 w-9 flex items-center justify-center text-white">
              <Download className="h-5 w-5" />
            </div>
          </button>
        )}

        {/* Report - show for viewers (not own video) */}
        {!isOwnVideo && (
          <button
            onClick={() => setShowReportDialog(true)}
            className="flex flex-col items-center"
          >
            <div className="rounded-full h-9 w-9 flex items-center justify-center text-white">
              <Flag className="h-4 w-4" />
            </div>
          </button>
        )}

        {/* Delete - only for own videos */}
        {isOwnVideo && onDelete && (
          <button
            onClick={onDelete}
            className="flex flex-col items-center"
          >
            <div className="rounded-full h-9 w-9 flex items-center justify-center text-red-500">
              <Trash2 className="h-5 w-5" />
            </div>
          </button>
        )}
      </div>

      {/* Report Dialog */}
      {showReportDialog && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-2xl p-4 max-w-xs w-full">
            <h3 className="text-lg font-bold mb-3">Report Video</h3>
            <div className="space-y-1.5">
              {['Inappropriate content', 'Spam', 'Violence', 'Copyright', 'Other'].map((reason) => (
                <Button
                  key={reason}
                  variant="outline"
                  size="sm"
                  className="w-full text-sm"
                  onClick={() => handleReport(reason)}
                >
                  {reason}
                </Button>
              ))}
              <Button variant="ghost" size="sm" className="w-full text-sm" onClick={() => setShowReportDialog(false)}>
                Cancel
              </Button>
            </div>
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
