import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Heart, MessageCircle, Download, Flag, Trash2, UserPlus, UserMinus, Volume2, VolumeX } from 'lucide-react';
import { toast } from 'sonner';
import { useSignedVideoUrl } from '@/hooks/useSignedVideoUrl';
import LikeAnimation from '@/components/LikeAnimation';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { addWatermarkToVideo } from '@/lib/videoWatermark';

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
  const [likeAnimations, setLikeAnimations] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const { signedUrl, loading, error } = useSignedVideoUrl(video.video_url);
  const lastTapRef = useRef<number>(0);
  const animationIdRef = useRef<number>(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const watchStartTimeRef = useRef<number>(Date.now());
  const analyticsTrackedRef = useRef<boolean>(false);

  useEffect(() => {
    checkIfFollowing();
    watchStartTimeRef.current = Date.now();
    analyticsTrackedRef.current = false;

    // Track analytics when component unmounts or video changes
    return () => {
      trackVideoAnalytics(false);
    };
  }, [video.id, currentUserId]);

  const trackVideoAnalytics = async (completed: boolean) => {
    if (analyticsTrackedRef.current) return;
    analyticsTrackedRef.current = true;

    const watchDuration = Math.floor((Date.now() - watchStartTimeRef.current) / 1000);
    
    // Only track if watched for at least 1 second
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

  // Track when video completes
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
      } else {
        await supabase.from('likes').insert({ video_id: video.id, user_id: currentUserId });
        setLikesCount(prev => prev + 1);
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
      // Double tap detected
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const y = 'touches' in e ? e.touches[0].clientY : e.clientY;
      
      // Add animation
      const id = animationIdRef.current++;
      setLikeAnimations(prev => [...prev, { id, x, y }]);
      
      // Like the video if not already liked
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
          videoRef.current.play();
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

  const handleDownload = async () => {
    const downloadToast = toast.loading('Processing: 0%');
    
    try {
      // Fetch the video blob
      const response = await fetch(signedUrl || video.video_url);
      if (!response.ok) throw new Error('Failed to fetch video');
      
      const videoBlob = await response.blob();
      
      // Add watermark with progress tracking
      const watermarkedBlob = await addWatermarkToVideo(
        videoBlob, 
        video.profiles.username,
        (progress) => {
          toast.loading(`Processing: ${progress}%`, { id: downloadToast });
        }
      );
      
      // Download watermarked video
      const url = URL.createObjectURL(watermarkedBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${video.title}_ToonReels.webm`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      // Log download
      await supabase.from('video_downloads').insert({
        video_id: video.id,
        user_id: currentUserId
      });
      
      toast.success('Download complete!', { id: downloadToast });
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
    <div className="relative h-screen w-full snap-start">
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
          <span className="text-white">Loading video...</span>
        </div>
      ) : error ? (
        <div className="h-full w-full bg-black flex items-center justify-center">
          <span className="text-white">Failed to load video</span>
        </div>
      ) : (
        <video
          ref={videoRef}
          src={signedUrl || ''}
          className="h-full w-full object-cover"
          loop
          autoPlay
          muted={isMuted}
          playsInline
          onTouchStart={handleDoubleTap}
          onDoubleClick={handleDoubleTap}
        />
      )}
      
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      
      {/* Volume Control */}
      <Button
        size="icon"
        variant="ghost"
        onClick={toggleMute}
        className="absolute top-4 right-4 z-10 rounded-full h-10 w-10 bg-black/30 text-white hover:bg-black/50"
      >
        {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
      </Button>
      
      {/* Video Info */}
      <div className="absolute bottom-20 left-3 right-16 text-white">
        <div 
          className="flex items-center gap-1.5 mb-1.5 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => navigate(`/profile?userId=${video.creator_id}`)}
        >
          <Avatar className="h-8 w-8 border-2 border-background">
            <AvatarImage src={video.profiles.avatar_url || undefined} alt={video.profiles.username} />
            <AvatarFallback className="bg-primary text-background text-sm font-bold">
              {video.profiles.username[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="font-semibold text-sm">{video.profiles.username}</span>
        </div>
        <h3 className="font-semibold text-base mb-0.5">{video.title}</h3>
        <p className="text-xs opacity-90 line-clamp-2">{video.description}</p>
      </div>

      {/* Action Buttons */}
      <div className="absolute bottom-20 right-2 flex flex-col gap-3">
        {/* Follow/Unfollow Button - only show if not own video */}
        {currentUserId && currentUserId !== video.creator_id && (
          <Button
            size="icon"
            variant="ghost"
            onClick={handleFollow}
            className={`rounded-full h-11 w-11 p-0 ${isFollowing ? 'text-primary' : 'text-white'}`}
          >
            <div className="flex flex-col items-center gap-0.5">
              {isFollowing ? (
                <UserMinus className="h-6 w-6" />
              ) : (
                <UserPlus className="h-6 w-6" />
              )}
              <span className="text-[10px] font-semibold leading-none">{isFollowing ? 'Following' : 'Follow'}</span>
            </div>
          </Button>
        )}
        
        <Button
          size="icon"
          variant="ghost"
          onClick={handleLike}
          className={`rounded-full h-11 w-11 p-0 ${liked ? 'text-primary' : 'text-white'}`}
        >
          <div className="flex flex-col items-center gap-0.5">
            <Heart className={`h-6 w-6 ${liked ? 'fill-current' : ''}`} />
            <span className="text-[10px] font-semibold leading-none">{likesCount}</span>
          </div>
        </Button>

        <Button
          size="icon"
          variant="ghost"
          onClick={onCommentsClick}
          className="rounded-full h-11 w-11 p-0 text-white"
        >
          <div className="flex flex-col items-center gap-0.5">
            <MessageCircle className="h-6 w-6" />
            <span className="text-[10px] font-semibold leading-none">Comment</span>
          </div>
        </Button>

        <Button
          size="icon"
          variant="ghost"
          onClick={handleDownload}
          className="rounded-full h-11 w-11 p-0 text-white"
        >
          <Download className="h-6 w-6" />
        </Button>

        <Button
          size="icon"
          variant="ghost"
          onClick={() => setShowReportDialog(true)}
          className="rounded-full h-11 w-11 p-0 text-white"
        >
          <Flag className="h-6 w-6" />
        </Button>

        {video.creator_id === currentUserId && onDelete && (
          <Button
            size="icon"
            variant="ghost"
            onClick={onDelete}
            className="rounded-full h-11 w-11 p-0 text-red-500"
          >
            <Trash2 className="h-6 w-6" />
          </Button>
        )}
      </div>

      {/* Report Dialog */}
      {showReportDialog && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-3xl p-6 max-w-sm w-full">
            <h3 className="text-xl font-black mb-4">Report Video</h3>
            <div className="space-y-2">
              {['Inappropriate content', 'Spam', 'Violence', 'Copyright', 'Other'].map((reason) => (
                <Button
                  key={reason}
                  variant="outline"
                  className="w-full"
                  onClick={() => handleReport(reason)}
                >
                  {reason}
                </Button>
              ))}
              <Button variant="ghost" className="w-full" onClick={() => setShowReportDialog(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
