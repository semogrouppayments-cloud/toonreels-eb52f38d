import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import VideoPlayer from '@/components/VideoPlayer';
import CommentsSheet from '@/components/CommentsSheet';
import BottomNav from '@/components/BottomNav';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Filter } from 'lucide-react';

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
  const [showFollowedOnly, setShowFollowedOnly] = useState(false);

  useEffect(() => {
    fetchVideos();
    fetchUserProfile();
  }, [showFollowedOnly]);

  const fetchVideos = async () => {
    let query = supabase
      .from('videos')
      .select(`
        *,
        profiles(username, avatar_url)
      `)
      .order('created_at', { ascending: false });

    if (showFollowedOnly && currentUserId) {
      // Get list of followed creators
      const { data: follows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', currentUserId);

      if (follows && follows.length > 0) {
        const followedIds = follows.map(f => f.following_id);
        query = query.in('creator_id', followedIds);
      } else {
        // If not following anyone, show empty
        setVideos([]);
        return;
      }
    }

    const { data } = await query;
    setVideos(data || []);
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
      
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      
      setIsPremium(profile?.is_premium || false);
      setIsCreative(roles?.some(r => r.role === 'creative') || false);
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
      {/* Filter button for followed creators */}
      {currentUserId && (
        <Button
          onClick={() => setShowFollowedOnly(!showFollowedOnly)}
          className={`fixed top-3 left-3 z-50 rounded-full h-9 px-3 text-xs ${
            showFollowedOnly
              ? 'bg-primary text-primary-foreground'
              : 'bg-card/95 backdrop-blur-lg border border-border text-foreground'
          } shadow-lg hover:scale-105 transition-all`}
        >
          <Filter className="h-3.5 w-3.5 mr-1.5" />
          {showFollowedOnly ? 'All' : 'Following'}
        </Button>
      )}

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
