import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Heart, MessageCircle, Download, Flag, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useSignedVideoUrl } from '@/hooks/useSignedVideoUrl';

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
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(video.likes_count);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const { signedUrl, loading, error } = useSignedVideoUrl(video.video_url);

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

  const handleDownload = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('download-video', {
        body: { video_id: video.id }
      });

      if (error) {
        if (error.message.includes('Premium')) {
          toast.error('Premium subscription required to download videos');
        } else if (error.message.includes('Unauthorized')) {
          toast.error('Please sign in to download videos');
        } else {
          toast.error('Failed to download video');
        }
        return;
      }

      if (data?.download_url) {
        const link = document.createElement('a');
        link.href = data.download_url;
        link.download = `${data.title || video.title}.mp4`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        toast.success('Video downloaded!');
      }
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download video');
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
          src={signedUrl || ''}
          className="h-full w-full object-cover"
          loop
          autoPlay
          muted
          playsInline
        />
      )}
      
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      
      {/* Video Info */}
      <div className="absolute bottom-20 left-4 right-20 text-white">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center font-bold">
            {video.profiles.username[0].toUpperCase()}
          </div>
          <span className="font-bold">{video.profiles.username}</span>
        </div>
        <h3 className="font-bold text-lg mb-1">{video.title}</h3>
        <p className="text-sm opacity-90 line-clamp-2">{video.description}</p>
      </div>

      {/* Action Buttons */}
      <div className="absolute bottom-20 right-4 flex flex-col gap-4">
        <Button
          size="icon"
          variant="ghost"
          onClick={handleLike}
          className={`rounded-full h-12 w-12 ${liked ? 'text-primary' : 'text-white'} hover:scale-110 transition-transform`}
        >
          <div className="flex flex-col items-center">
            <Heart className={`h-7 w-7 ${liked ? 'fill-current' : ''}`} />
            <span className="text-xs font-semibold">{likesCount}</span>
          </div>
        </Button>

        <Button
          size="icon"
          variant="ghost"
          onClick={onCommentsClick}
          className="rounded-full h-12 w-12 text-white hover:scale-110 transition-transform"
        >
          <div className="flex flex-col items-center">
            <MessageCircle className="h-7 w-7" />
            <span className="text-xs font-semibold">Comment</span>
          </div>
        </Button>

        <Button
          size="icon"
          variant="ghost"
          onClick={handleDownload}
          className="rounded-full h-12 w-12 text-white hover:scale-110 transition-transform"
        >
          <Download className="h-7 w-7" />
        </Button>

        <Button
          size="icon"
          variant="ghost"
          onClick={() => setShowReportDialog(true)}
          className="rounded-full h-12 w-12 text-white hover:scale-110 transition-transform"
        >
          <Flag className="h-7 w-7" />
        </Button>

        {video.creator_id === currentUserId && onDelete && (
          <Button
            size="icon"
            variant="ghost"
            onClick={onDelete}
            className="rounded-full h-12 w-12 text-red-500 hover:scale-110 transition-transform"
          >
            <Trash2 className="h-7 w-7" />
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
