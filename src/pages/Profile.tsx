import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { LogOut, Settings, Video } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import { toast } from 'sonner';

interface Profile {
  username: string;
  user_type: string;
  bio: string;
  avatar_url: string;
}

interface Video {
  id: string;
  title: string;
  thumbnail_url: string;
  views_count: number;
  likes_count: number;
}

const Profile = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);

  useEffect(() => {
    fetchProfile();
    fetchUserVideos();
  }, []);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/auth');
      return;
    }

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    setProfile(data);
  };

  const fetchUserVideos = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('videos')
      .select('*')
      .eq('creator_id', user.id)
      .order('created_at', { ascending: false });

    setVideos(data || []);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success('Signed out successfully');
    navigate('/auth');
  };

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-br from-primary via-accent to-fun-yellow p-8">
          <div className="flex justify-end gap-2 mb-4">
            <Button
              variant="secondary"
              size="icon"
              className="rounded-full"
            >
              <Settings className="h-5 w-5" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              onClick={handleSignOut}
              className="rounded-full"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>

          <div className="text-center">
            <div className="h-24 w-24 rounded-full bg-background/20 backdrop-blur-lg flex items-center justify-center text-background font-black text-4xl mx-auto mb-4">
              {profile.username[0].toUpperCase()}
            </div>
            <h1 className="text-2xl font-black text-background mb-2">
              {profile.username}
            </h1>
            <p className="text-background/90 font-semibold capitalize">
              {profile.user_type}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 p-4 -mt-8">
          <Card className="p-4 text-center shadow-elevated">
            <p className="text-2xl font-black text-primary">
              {videos.reduce((sum, v) => sum + v.views_count, 0)}
            </p>
            <p className="text-sm text-muted-foreground">Views</p>
          </Card>
          <Card className="p-4 text-center shadow-elevated">
            <p className="text-2xl font-black text-primary">
              {videos.reduce((sum, v) => sum + v.likes_count, 0)}
            </p>
            <p className="text-sm text-muted-foreground">Likes</p>
          </Card>
          <Card className="p-4 text-center shadow-elevated">
            <p className="text-2xl font-black text-primary">{videos.length}</p>
            <p className="text-sm text-muted-foreground">Videos</p>
          </Card>
        </div>

        {/* Videos Grid */}
        {profile.user_type === 'creative' && (
          <div className="p-4">
            <h2 className="text-xl font-black mb-4 flex items-center gap-2">
              <Video className="h-6 w-6 text-primary" />
              My Animations
            </h2>
            
            {videos.length === 0 ? (
              <Card className="p-12 text-center">
                <Video className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No videos yet</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Start creating amazing animations!
                </p>
                <Button
                  onClick={() => navigate('/upload')}
                  className="mt-4"
                >
                  Upload Your First Video
                </Button>
              </Card>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {videos.map((video) => (
                  <div
                    key={video.id}
                    className="aspect-[9/16] rounded-2xl bg-gradient-to-br from-primary/20 via-accent/20 to-fun-blue/20 overflow-hidden cursor-pointer hover:scale-105 transition-transform"
                  >
                    <div className="h-full flex flex-col justify-end p-3">
                      <p className="text-white text-xs font-bold drop-shadow-lg line-clamp-2">
                        {video.title}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default Profile;
