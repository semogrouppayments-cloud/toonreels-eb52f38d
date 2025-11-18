import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Heart, MessageCircle, Share2, MoreVertical } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface Video {
  id: string;
  title: string;
  description: string;
  video_url: string;
  thumbnail_url: string;
  likes_count: number;
  views_count: number;
  creator_id: string;
  profiles: {
    username: string;
    avatar_url: string;
  };
}

const Feed = () => {
  const navigate = useNavigate();
  const [videos, setVideos] = useState<Video[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth');
        return;
      }
    };

    checkAuth();
    fetchVideos();
  }, [navigate]);

  const fetchVideos = async () => {
    const { data, error } = await supabase
      .from('videos')
      .select(`
        *,
        profiles (
          username,
          avatar_url
        )
      `)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      toast.error('Failed to load videos');
      return;
    }

    setVideos(data || []);
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const scrollTop = container.scrollTop;
    const itemHeight = container.clientHeight;
    const index = Math.round(scrollTop / itemHeight);
    
    if (index !== currentIndex && index >= 0 && index < videos.length) {
      setCurrentIndex(index);
    }
  };

  const handleLike = async (videoId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const isLiked = liked.has(videoId);

    if (isLiked) {
      await supabase
        .from('likes')
        .delete()
        .eq('user_id', user.id)
        .eq('video_id', videoId);
      
      setLiked(prev => {
        const newSet = new Set(prev);
        newSet.delete(videoId);
        return newSet;
      });
    } else {
      await supabase
        .from('likes')
        .insert({ user_id: user.id, video_id: videoId });
      
      setLiked(prev => new Set(prev).add(videoId));
    }
  };

  return (
    <div className="relative h-screen overflow-hidden bg-background">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-screen overflow-y-scroll snap-y snap-mandatory scroll-smooth"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {videos.map((video, index) => (
          <div
            key={video.id}
            className="h-screen w-full snap-start relative flex items-center justify-center bg-black"
          >
            {/* Video placeholder - In production, use actual video player */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-accent/20 to-fun-blue/20 flex items-center justify-center">
              <div className="text-center">
                <div className="text-6xl mb-4">🎬</div>
                <p className="text-white text-xl font-bold">{video.title}</p>
              </div>
            </div>

            {/* Creator info */}
            <div className="absolute top-4 left-4 flex items-center gap-3 z-10">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold">
                {video.profiles.username[0].toUpperCase()}
              </div>
              <div className="text-white">
                <p className="font-bold drop-shadow-lg">{video.profiles.username}</p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="absolute right-4 bottom-24 flex flex-col gap-6 z-10">
              <button
                onClick={() => handleLike(video.id)}
                className="flex flex-col items-center gap-1"
              >
                <div className={`h-12 w-12 rounded-full flex items-center justify-center backdrop-blur-md transition-all ${
                  liked.has(video.id) ? 'bg-primary text-primary-foreground' : 'bg-card/80 text-foreground'
                }`}>
                  <Heart className={`h-6 w-6 ${liked.has(video.id) ? 'fill-current' : ''}`} />
                </div>
                <span className="text-white text-xs font-bold drop-shadow-lg">{video.likes_count}</span>
              </button>

              <button className="flex flex-col items-center gap-1">
                <div className="h-12 w-12 rounded-full bg-card/80 flex items-center justify-center backdrop-blur-md">
                  <MessageCircle className="h-6 w-6 text-foreground" />
                </div>
                <span className="text-white text-xs font-bold drop-shadow-lg">0</span>
              </button>

              <button className="flex flex-col items-center gap-1">
                <div className="h-12 w-12 rounded-full bg-card/80 flex items-center justify-center backdrop-blur-md">
                  <Share2 className="h-6 w-6 text-foreground" />
                </div>
              </button>

              <button className="flex flex-col items-center gap-1">
                <div className="h-12 w-12 rounded-full bg-card/80 flex items-center justify-center backdrop-blur-md">
                  <MoreVertical className="h-6 w-6 text-foreground" />
                </div>
              </button>
            </div>

            {/* Video description */}
            <div className="absolute bottom-24 left-4 right-20 z-10">
              <p className="text-white font-semibold drop-shadow-lg line-clamp-2">
                {video.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      <BottomNav />
    </div>
  );
};

export default Feed;
