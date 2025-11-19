import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { LogOut, Settings, Video, Camera, Edit, BarChart3 } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import { toast } from 'sonner';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import VideoPlayer from '@/components/VideoPlayer';

interface Profile {
  id?: string;
  username: string;
  user_type: string;
  bio: string;
  avatar_url: string;
  cover_photo_url?: string;
}

interface Video {
  id: string;
  title: string;
  thumbnail_url: string;
  views_count: number;
  likes_count: number;
  video_url: string;
  description: string;
  creator_id: string;
}

const Profile = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [editingUsername, setEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [isOwnProfile, setIsOwnProfile] = useState(true);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [selectedVideoIndex, setSelectedVideoIndex] = useState<number | null>(null);
  const [isCreative, setIsCreative] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('userId');
    fetchProfile(userId);
    fetchUserVideos(userId);
    fetchFollowCounts(userId);
    checkIfCreative();
  }, [window.location.search]);

  const checkIfCreative = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    setIsCreative(roles?.some(r => r.role === 'creative') || false);
  };

  const fetchFollowCounts = async (userId?: string | null) => {
    const { data: { user } } = await supabase.auth.getUser();
    const targetUserId = userId || user?.id;
    
    if (!targetUserId) return;

    // Get followers count
    const { count: followers } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', targetUserId);

    // Get following count
    const { count: following } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', targetUserId);

    setFollowersCount(followers || 0);
    setFollowingCount(following || 0);
  };

  const fetchProfile = async (userId?: string | null) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user && !userId) {
      navigate('/auth');
      return;
    }

    const targetUserId = userId || user?.id;
    setIsOwnProfile(!userId || userId === user?.id);

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', targetUserId)
      .single();

    if (data) {
      setProfile({ ...data, id: data.id || targetUserId });
      setNewUsername(data.username);
    }
  };

  const fetchUserVideos = async (userId?: string | null) => {
    const { data: { user } } = await supabase.auth.getUser();
    const targetUserId = userId || user?.id;
    
    if (!targetUserId) return;

    const { data } = await supabase
      .from('videos')
      .select('*')
      .eq('creator_id', targetUserId)
      .order('created_at', { ascending: false });

    setVideos(data || []);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success('Signed out successfully');
    navigate('/auth');
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      toast.success('Profile picture updated!');
      fetchProfile(null);
    } catch (error) {
      toast.error('Failed to upload avatar');
    }
  };

  const handleCoverPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/cover.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      await supabase
        .from('profiles')
        .update({ cover_photo_url: publicUrl })
        .eq('id', user.id);

      toast.success('Cover photo updated!');
      fetchProfile(null);
    } catch (error) {
      toast.error('Failed to upload cover photo');
    }
  };

  const handleUsernameUpdate = async () => {
    if (!newUsername.trim()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('profiles')
        .update({ username: newUsername })
        .eq('id', user.id);

      toast.success('Username updated!');
      setEditingUsername(false);
      fetchProfile(null);
    } catch (error) {
      toast.error('Failed to update username');
    }
  };

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-2xl mx-auto">
        {/* Header with Cover Photo */}
        <div className="relative bg-gradient-to-br from-primary via-accent to-fun-yellow" style={{ paddingBottom: '120px' }}>
          {/* Cover Photo - fills the entire header with fade overlay */}
          {profile?.cover_photo_url && (
            <>
              <img 
                src={profile.cover_photo_url} 
                alt="Cover" 
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
            </>
          )}

          {/* Settings and Sign Out Buttons */}
          <div className="relative flex justify-end gap-2 p-4 z-10">
            {isOwnProfile && (
              <>
                {isCreative && (
                  <Button
                    variant="secondary"
                    size="icon"
                    className="rounded-full"
                    onClick={() => navigate('/creator-dashboard')}
                  >
                    <BarChart3 className="h-5 w-5" />
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="icon"
                  className="rounded-full"
                  onClick={() => navigate('/settings')}
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
              </>
            )}
          </div>

          {/* Profile Info - positioned over cover photo */}
          <div className="relative text-center px-8 pb-8 z-10">
            <div className="relative inline-block mb-4">
              <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
                <AvatarImage src={profile.avatar_url || undefined} alt={profile.username} />
                <AvatarFallback className="bg-primary text-primary-foreground font-black text-4xl">
                  {profile.username[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {isOwnProfile && (
                <label
                  htmlFor="avatar-upload"
                  className="absolute bottom-0 right-0 bg-primary text-primary-foreground rounded-full p-2 cursor-pointer hover:scale-110 transition-transform shadow-lg"
                >
                  <Camera className="h-4 w-4" />
                  <input
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>
            
            {/* Cover Photo Upload Button - Bottom Position */}
            {isOwnProfile && (
              <label
                htmlFor="cover-upload"
                className="absolute bottom-3 right-3 bg-background/90 backdrop-blur-sm text-foreground rounded-full p-2 cursor-pointer hover:bg-background transition-colors z-10"
              >
                <Camera className="h-4 w-4" />
                <input
                  id="cover-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleCoverPhotoUpload}
                  className="hidden"
                />
              </label>
            )}
            
            {editingUsername && isOwnProfile ? (
              <div className="flex items-center justify-center gap-2 mb-2">
                <Input
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="max-w-xs text-background font-black"
                  placeholder="New username"
                />
                <Button size="sm" onClick={handleUsernameUpdate}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingUsername(false)}>Cancel</Button>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 mb-2">
                <h1 className="text-2xl font-black text-background">
                  {profile.username}
                </h1>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-background"
                  onClick={() => {
                    setNewUsername(profile.username);
                    setEditingUsername(true);
                  }}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </div>
            )}
            <p className="text-white drop-shadow-lg font-semibold capitalize">
              {profile.user_type}
            </p>

            {/* Stats - Positioned on cover photo */}
            <div className="grid grid-cols-4 gap-2 mt-6">
              <div className="text-center">
                <p className="text-2xl font-black text-white drop-shadow-lg">
                  {videos.reduce((sum, v) => sum + v.views_count, 0)}
                </p>
                <p className="text-[10px] text-white/90 drop-shadow-md font-semibold">Views</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-black text-white drop-shadow-lg">
                  {videos.reduce((sum, v) => sum + v.likes_count, 0)}
                </p>
                <p className="text-[10px] text-white/90 drop-shadow-md font-semibold">Likes</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-black text-white drop-shadow-lg">{followersCount}</p>
                <p className="text-[10px] text-white/90 drop-shadow-md font-semibold">Followers</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-black text-white drop-shadow-lg">{videos.length}</p>
                <p className="text-[10px] text-white/90 drop-shadow-md font-semibold">Videos</p>
              </div>
            </div>
          </div>
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
                {videos.map((video, index) => (
                  <div key={video.id} className="relative group">
                    <div
                      onClick={() => setSelectedVideoIndex(index)}
                      className="aspect-[9/16] rounded-2xl bg-gradient-to-br from-primary/20 via-accent/20 to-fun-blue/20 overflow-hidden cursor-pointer hover:scale-105 transition-transform"
                    >
                      <div className="h-full flex flex-col justify-end p-3">
                        <p className="text-white text-xs font-bold drop-shadow-lg line-clamp-2">
                          {video.title}
                        </p>
                      </div>
                    </div>
                    {/* Analytics button for own videos */}
                    {isOwnProfile && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/video-analytics/${video.id}`);
                        }}
                        className="absolute top-2 right-2 h-7 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        Stats
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Video Viewer Modal */}
      {selectedVideoIndex !== null && (
        <div className="fixed inset-0 z-50 bg-background">
          <div className="h-screen overflow-y-scroll snap-y snap-mandatory">
            {videos.map((video, index) => (
              <div key={video.id} className="h-screen snap-start relative">
                <VideoPlayer
                  video={{
                    ...video,
                    profiles: {
                      username: profile?.username || '',
                      avatar_url: profile?.avatar_url || '',
                    }
                  }}
                  currentUserId={profile?.id || ''}
                  isPremium={false}
                  onCommentsClick={() => {}}
                  onDelete={() => {
                    setSelectedVideoIndex(null);
                    fetchUserVideos(null);
                  }}
                />
              </div>
            ))}
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setSelectedVideoIndex(null)}
            className="fixed top-4 left-4 z-50 rounded-full bg-black/50 text-white"
          >
            ✕
          </Button>
        </div>
      )}

      <BottomNav />
    </div>
  );
};

export default Profile;
