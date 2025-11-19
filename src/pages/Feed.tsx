import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import VideoPlayer from '@/components/VideoPlayer';
import CommentsSheet from '@/components/CommentsSheet';
import BottomNav from '@/components/BottomNav';
import StoryCircles from '@/components/StoryCircles';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

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

const Feed = () => {
  const navigate = useNavigate();
  const [videos, setVideos] = useState<Video[]>([]);
  const [currentUserId, setCurrentUserId] = useState('');
  const [isPremium, setIsPremium] = useState(false);
  const [isCreative, setIsCreative] = useState(false);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);

  useEffect(() => {
    fetchVideos();
    fetchUserProfile();
  }, []);

  const fetchVideos = async () => {
    const { data } = await supabase
      .from('videos')
      .select(`
        *,
        profiles(username, avatar_url)
      `)
      .order('created_at', { ascending: false });

    setVideos(data || []);
  };

  const fetchUserProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_premium, user_type')
        .eq('id', user.id)
        .single();
      
      setIsPremium(profile?.is_premium || false);
      setIsCreative(profile?.user_type === 'creative');
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
    <div className="h-screen overflow-y-scroll snap-y snap-mandatory bg-background">
      {/* Add story button for creators in top left */}
      {isCreative && (
        <button
          onClick={() => navigate('/upload')}
          className="fixed top-4 left-4 z-50 bg-primary/95 backdrop-blur-lg border-2 border-primary rounded-full w-14 h-14 flex items-center justify-center shadow-lg hover:bg-primary/80 transition-colors text-2xl"
          aria-label="Add Story"
        >
          ➕
        </button>
      )}
      
      {/* Story circles for creator previews */}
      <StoryCircles />
      
      {/* Messages emoji button in top right */}
      <button
        onClick={() => navigate('/messages')}
        className="fixed top-4 right-4 z-50 bg-card/95 backdrop-blur-lg border-2 border-border rounded-full w-14 h-14 flex items-center justify-center shadow-lg hover:bg-accent transition-colors text-2xl"
        aria-label="Messages"
      >
        💬
      </button>

      {videos.map((video) => (
        <VideoPlayer
          key={video.id}
          video={video}
          currentUserId={currentUserId}
          isPremium={isPremium}
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
