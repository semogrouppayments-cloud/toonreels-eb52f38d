import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Play, Pause, Heart, MessageCircle, Share2, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface NotificationVideoModalProps {
  videoId: string;
  onClose: () => void;
}

interface VideoData {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  views_count: number;
  likes_count: number;
  creator_id: string;
  creator?: {
    username: string;
    avatar_url: string | null;
    is_verified: boolean;
  };
}

const NotificationVideoModal = ({ videoId, onClose }: NotificationVideoModalProps) => {
  const [video, setVideo] = useState<VideoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    fetchVideo();
    checkIfLiked();
  }, [videoId]);

  const fetchVideo = async () => {
    try {
      const { data } = await supabase
        .from('videos')
        .select(`
          *,
          profiles:creator_id (
            username,
            avatar_url,
            is_verified
          )
        `)
        .eq('id', videoId)
        .single();

      if (data) {
        setVideo({
          ...data,
          creator: data.profiles as any
        });
        setLikesCount(data.likes_count);

        // Get signed URL for video
        const storagePath = data.video_url.replace(/.*\/videos\//, '');
        const { data: signedData, error } = await supabase.storage
          .from('videos')
          .createSignedUrl(storagePath, 3600);
        
        if (!error && signedData) {
          setSignedUrl(signedData.signedUrl);
        }

        // Increment views
        await supabase.rpc('increment_video_views', { _video_id: videoId });
      }
    } catch (error) {
      console.error('Error fetching video:', error);
      toast.error('Failed to load video');
    } finally {
      setLoading(false);
    }
  };

  const checkIfLiked = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('likes')
      .select('id')
      .eq('user_id', user.id)
      .eq('video_id', videoId)
      .maybeSingle();

    setIsLiked(!!data);
  };

  const handleLike = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      if (isLiked) {
        await supabase
          .from('likes')
          .delete()
          .eq('user_id', user.id)
          .eq('video_id', videoId);
        setIsLiked(false);
        setLikesCount(prev => Math.max(0, prev - 1));
      } else {
        await supabase
          .from('likes')
          .insert({ user_id: user.id, video_id: videoId });
        setIsLiked(true);
        setLikesCount(prev => prev + 1);
      }
    } catch (error) {
      toast.error('Failed to update like');
    }
  };

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleShare = async () => {
    try {
      await navigator.share({
        title: video?.title || 'Check out this video!',
        url: window.location.origin + `/feed?video=${videoId}`
      });
    } catch {
      toast.info('Copied to clipboard!');
      navigator.clipboard.writeText(window.location.origin + `/feed?video=${videoId}`);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center gap-4">
        <p className="text-white">Video not found</p>
        <Button onClick={onClose} variant="outline">Go Back</Button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Back Button */}
      <div className="absolute top-4 left-4 z-10 safe-area-inset-top">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="rounded-full bg-black/50 hover:bg-black/70 text-white"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </div>

      {/* Video Container with Rounded Corners */}
      <div className="absolute inset-4 top-16 bottom-4 rounded-3xl overflow-hidden bg-black/50">
        <div className="relative w-full h-full" onClick={togglePlayPause}>
          <video
            ref={videoRef}
            src={signedUrl || video.video_url}
            className="w-full h-full object-contain"
            autoPlay
            loop
            playsInline
            muted={isMuted}
          />

          {/* Play/Pause Overlay */}
          {!isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <div className="bg-white/20 backdrop-blur-sm rounded-full p-6">
                <Play className="h-12 w-12 text-white fill-white" />
              </div>
            </div>
          )}

          {/* Video Info */}
          <div className="absolute bottom-0 left-0 right-16 p-4 bg-gradient-to-t from-black/80 to-transparent">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center overflow-hidden">
                {video.creator?.avatar_url ? (
                  <img src={video.creator.avatar_url} alt={video.creator.username} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white font-bold">{video.creator?.username?.[0]?.toUpperCase() || '?'}</span>
                )}
              </div>
              <span className="text-white font-semibold text-sm">
                @{video.creator?.username || 'unknown'}
              </span>
              {video.creator?.is_verified && (
                <span className="bg-yellow-400 text-black text-[10px] px-1 rounded">✓</span>
              )}
            </div>
            <h3 className="text-white font-bold text-base mb-1 line-clamp-1">{video.title}</h3>
            {video.description && (
              <p className="text-white/80 text-xs line-clamp-2">{video.description}</p>
            )}
          </div>

          {/* Side Actions */}
          <div className="absolute right-2 bottom-20 flex flex-col items-center gap-5">
            <button 
              onClick={(e) => { e.stopPropagation(); handleLike(); }}
              className="flex flex-col items-center gap-1"
            >
              <div className={`p-2 rounded-full ${isLiked ? 'bg-red-500' : 'bg-black/50'}`}>
                <Heart className={`h-6 w-6 ${isLiked ? 'text-white fill-white' : 'text-white'}`} />
              </div>
              <span className="text-white text-xs">{likesCount}</span>
            </button>

            <button 
              onClick={(e) => { e.stopPropagation(); toggleMute(); }}
              className="flex flex-col items-center gap-1"
            >
              <div className="p-2 rounded-full bg-black/50">
                {isMuted ? (
                  <VolumeX className="h-6 w-6 text-white" />
                ) : (
                  <Volume2 className="h-6 w-6 text-white" />
                )}
              </div>
            </button>

            <button 
              onClick={(e) => { e.stopPropagation(); handleShare(); }}
              className="flex flex-col items-center gap-1"
            >
              <div className="p-2 rounded-full bg-black/50">
                <Share2 className="h-6 w-6 text-white" />
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationVideoModal;
