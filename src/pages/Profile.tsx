import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { LogOut, Settings, Video, Camera, Edit, BarChart3, Bookmark } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import NotificationBell from '@/components/NotificationBell';
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
  const [editingBio, setEditingBio] = useState(false);
  const [newBio, setNewBio] = useState('');
  const [isOwnProfile, setIsOwnProfile] = useState(true);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [totalViews, setTotalViews] = useState(0);
  const [totalLikes, setTotalLikes] = useState(0);
  const [selectedVideoIndex, setSelectedVideoIndex] = useState<number | null>(null);
  const [isCreative, setIsCreative] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [savedVideos, setSavedVideos] = useState<Video[]>([]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('userId');
    fetchProfile(userId);
    fetchUserVideos(userId);
    fetchSavedVideos(userId);
    fetchFollowCounts(userId);
    fetchStatsCounts(userId);
    checkIfCreative();
    checkIfFollowing(userId);
  }, [window.location.search]);

  const checkIfCreative = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setCurrentUserId(user.id);

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    setIsCreative(roles?.some(r => r.role === 'creative') || false);
  };

  const checkIfFollowing = async (userId?: string | null) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !userId || userId === user.id) return;

    const { data } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', user.id)
      .eq('following_id', userId)
      .single();

    setIsFollowing(!!data);
  };

  const handleFollowToggle = async () => {
    if (!currentUserId || !profile?.id) return;

    try {
      if (isFollowing) {
        await supabase
          .from('follows')
          .delete()
          .eq('follower_id', currentUserId)
          .eq('following_id', profile.id);
        setIsFollowing(false);
        setFollowersCount(prev => prev - 1);
        toast.success('Unfollowed');
      } else {
        await supabase
          .from('follows')
          .insert({
            follower_id: currentUserId,
            following_id: profile.id
          });
        setIsFollowing(true);
        setFollowersCount(prev => prev + 1);
        toast.success('Following!');
      }
    } catch (error) {
      toast.error('Failed to update follow status');
    }
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

  const fetchStatsCounts = async (userId?: string | null) => {
    const { data: { user } } = await supabase.auth.getUser();
    const targetUserId = userId || user?.id;
    
    if (!targetUserId) return;

    // Get profile to check user type
    const { data: profileData } = await supabase
      .from('profiles')
      .select('user_type')
      .eq('id', targetUserId)
      .single();

    if (profileData?.user_type === 'creative') {
      // For creatives: Get total views and likes from all their videos
      const { data: videos } = await supabase
        .from('videos')
        .select('views_count, likes_count')
        .eq('creator_id', targetUserId);

      if (videos) {
        const views = videos.reduce((sum, v) => sum + (v.views_count || 0), 0);
        const likes = videos.reduce((sum, v) => sum + (v.likes_count || 0), 0);
        setTotalViews(views);
        setTotalLikes(likes);
      }
    } else {
      // For viewers: Get total views and likes from their saved videos
      const { data: savedData } = await supabase
        .from('saved_videos')
        .select(`
          videos (
            views_count,
            likes_count
          )
        `)
        .eq('user_id', targetUserId);

      if (savedData) {
        const views = savedData.reduce((sum, item: any) => sum + (item.videos?.views_count || 0), 0);
        const likes = savedData.reduce((sum, item: any) => sum + (item.videos?.likes_count || 0), 0);
        setTotalViews(views);
        setTotalLikes(likes);
      }
    }
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
      setNewBio(data.bio || '');
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

  const fetchSavedVideos = async (userId?: string | null) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const profileId = userId || user?.id;
      if (!profileId) return;

      const { data } = await supabase
        .from('saved_videos')
        .select(`
          video_id,
          videos (
            id,
            title,
            thumbnail_url,
            views_count,
            likes_count,
            video_url,
            description,
            creator_id
          )
        `)
        .eq('user_id', profileId)
        .order('created_at', { ascending: false });

      if (data) {
        const videos = data.map(item => item.videos).filter(Boolean) as Video[];
        setSavedVideos(videos);
      }
    } catch (error) {
      console.error('Error fetching saved videos:', error);
    }
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

  const handleBioUpdate = async () => {
    if (newBio.length > 200) {
      toast.error('Bio must be 200 characters or less');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('profiles')
        .update({ bio: newBio.trim() })
        .eq('id', user.id);

      toast.success('Bio updated!');
      setEditingBio(false);
      fetchProfile(null);
    } catch (error) {
      toast.error('Failed to update bio');
    }
  };

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-2xl mx-auto">
        {/* Header with Cover Photo */}
        <div className="relative bg-gradient-to-br from-primary via-accent to-fun-yellow h-64 overflow-hidden rounded-3xl mx-4 mt-4">
          {/* Cover Photo - fills the entire header with gradient overlay */}
          {profile?.cover_photo_url && (
            <>
              <img 
                src={profile.cover_photo_url} 
                alt="Cover" 
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/20" />
            </>
          )}

          {/* Cover Photo Upload Area - Make entire area clickable if own profile */}
          {isOwnProfile && (
            <>
              <label
                htmlFor="cover-upload"
                className="absolute inset-0 cursor-pointer group"
                title="Click to change cover photo"
              >
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <div className="bg-background/90 backdrop-blur-sm text-foreground rounded-full p-3 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                    <Camera className="h-6 w-6" />
                  </div>
                </div>
              </label>
              <input
                id="cover-upload"
                type="file"
                accept="image/*"
                onChange={handleCoverPhotoUpload}
                className="hidden"
              />
            </>
          )}

          {/* Settings and Sign Out Buttons / Follow Button */}
          <div className="relative flex justify-end gap-2 p-4 z-10">
            {isOwnProfile ? (
              <>
                <NotificationBell />
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
            ) : (
              <Button
                onClick={handleFollowToggle}
                variant={isFollowing ? "outline" : "default"}
                className="rounded-full"
              >
                {isFollowing ? 'Unfollow' : 'Follow'}
              </Button>
            )}
          </div>

          {/* Profile Info - Responsive Layout */}
          <div className="relative px-4 md:px-8 pt-4 z-10">
            {/* Profile Section */}
            <div className="flex items-center gap-3 mb-4">
              <div className="relative">
                <Avatar className="h-16 w-16 md:h-20 md:w-20 border-4 border-background shadow-lg">
                  <AvatarImage src={profile.avatar_url || undefined} alt={profile.username} />
                  <AvatarFallback className="bg-primary text-primary-foreground font-black text-2xl md:text-3xl">
                    {profile.username[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {isOwnProfile && (
                  <label
                    htmlFor="avatar-upload"
                    className="absolute bottom-0 right-0 bg-primary text-primary-foreground rounded-full p-1.5 cursor-pointer hover:scale-110 transition-transform shadow-lg"
                  >
                    <Camera className="h-3 w-3" />
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
              
              <div className="flex-1 text-left">
                {editingUsername && isOwnProfile ? (
                  <div className="flex items-center gap-2 mb-1">
                    <Input
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      className="max-w-xs text-white font-black"
                      placeholder="New username"
                    />
                    <Button size="sm" onClick={handleUsernameUpdate}>Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingUsername(false)}>Cancel</Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mb-1">
                    <h1 className="text-xl md:text-2xl font-black text-white drop-shadow-lg">
                      {profile.username}
                    </h1>
                    {isOwnProfile && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-white"
                        onClick={() => {
                          setNewUsername(profile.username);
                          setEditingUsername(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}
                <p className="text-white/90 drop-shadow-lg font-semibold capitalize text-xs md:text-sm">
                  {profile.user_type}
                </p>
                
                {/* Bio Section */}
                {editingBio && isOwnProfile ? (
                  <div className="mt-2 space-y-2">
                    <div className="relative">
                      <textarea
                        value={newBio}
                        onChange={(e) => setNewBio(e.target.value)}
                        maxLength={200}
                        placeholder="Add a bio..."
                        className="w-full max-w-xs text-white bg-black/30 backdrop-blur-sm rounded-lg p-2 text-xs resize-none border border-white/20 focus:border-white/40 outline-none"
                        rows={3}
                      />
                      <span className="text-[10px] text-white/60 absolute bottom-1 right-2">
                        {newBio.length}/200
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleBioUpdate} className="h-7 text-xs">
                        Save
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => {
                          setEditingBio(false);
                          setNewBio(profile.bio || '');
                        }}
                        className="h-7 text-xs text-white"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-1 mt-1">
                    {profile.bio ? (
                      <p className="text-white/80 drop-shadow-md text-xs flex-1">
                        {profile.bio}
                      </p>
                    ) : isOwnProfile ? (
                      <p className="text-white/60 drop-shadow-md text-xs italic flex-1">
                        No bio yet
                      </p>
                    ) : null}
                    {isOwnProfile && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-5 w-5 text-white/80 hover:text-white"
                        onClick={() => {
                          setNewBio(profile.bio || '');
                          setEditingBio(true);
                        }}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Stats Row - Conditional based on user type */}
            {profile.user_type === 'creative' ? (
              // Creative users: Show all stats (Views, Likes, Followers, Videos)
              <div className="flex items-center justify-around gap-2 px-2">
                <div className="flex flex-col items-center min-w-0">
                  <p className="text-lg md:text-xl font-black text-white drop-shadow-lg">
                    {totalViews}
                  </p>
                  <p className="text-[10px] md:text-xs text-white/90 drop-shadow-md font-semibold">Views</p>
                </div>
                <div className="h-8 w-px bg-white/20"></div>
                <div className="flex flex-col items-center min-w-0">
                  <p className="text-lg md:text-xl font-black text-white drop-shadow-lg">
                    {totalLikes}
                  </p>
                  <p className="text-[10px] md:text-xs text-white/90 drop-shadow-md font-semibold">Likes</p>
                </div>
                <div className="h-8 w-px bg-white/20"></div>
                <div className="flex flex-col items-center min-w-0">
                  <p className="text-lg md:text-xl font-black text-white drop-shadow-lg">{followersCount}</p>
                  <p className="text-[10px] md:text-xs text-white/90 drop-shadow-md font-semibold">Followers</p>
                </div>
                <div className="h-8 w-px bg-white/20"></div>
                <div className="flex flex-col items-center min-w-0">
                  <p className="text-lg md:text-xl font-black text-white drop-shadow-lg">{videos.length}</p>
                  <p className="text-[10px] md:text-xs text-white/90 drop-shadow-md font-semibold">Videos</p>
                </div>
              </div>
            ) : (
              // Viewer users: Show Views, Likes, Followers, Following (like TikTok)
              <div className="flex items-center justify-around gap-2 px-2">
                <div className="flex flex-col items-center min-w-0">
                  <p className="text-lg md:text-xl font-black text-white drop-shadow-lg">
                    {totalViews}
                  </p>
                  <p className="text-[10px] md:text-xs text-white/90 drop-shadow-md font-semibold">Views</p>
                </div>
                <div className="h-8 w-px bg-white/20"></div>
                <div className="flex flex-col items-center min-w-0">
                  <p className="text-lg md:text-xl font-black text-white drop-shadow-lg">
                    {totalLikes}
                  </p>
                  <p className="text-[10px] md:text-xs text-white/90 drop-shadow-md font-semibold">Likes</p>
                </div>
                <div className="h-8 w-px bg-white/20"></div>
                <div className="flex flex-col items-center min-w-0">
                  <p className="text-lg md:text-xl font-black text-white drop-shadow-lg">{followersCount}</p>
                  <p className="text-[10px] md:text-xs text-white/90 drop-shadow-md font-semibold">Followers</p>
                </div>
                <div className="h-8 w-px bg-white/20"></div>
                <div className="flex flex-col items-center min-w-0">
                  <p className="text-lg md:text-xl font-black text-white drop-shadow-lg">{followingCount}</p>
                  <p className="text-[10px] md:text-xs text-white/90 drop-shadow-md font-semibold">Following</p>
                </div>
              </div>
            )}
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
                      className="aspect-[9/16] rounded-2xl overflow-hidden cursor-pointer hover:scale-105 transition-transform relative"
                    >
                      {/* Video Thumbnail/Cover Photo */}
                      {video.thumbnail_url ? (
                        <img 
                          src={video.thumbnail_url} 
                          alt={video.title}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-accent/20 to-fun-blue/20" />
                      )}
                      
                      {/* Gradient overlay for text readability */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                      
                      {/* Video Title */}
                      <div className="absolute bottom-0 left-0 right-0 p-3">
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

        {/* Saved Videos for Viewers */}
        {profile.user_type === 'viewer' && isOwnProfile && (
          <div className="p-4">
            <h2 className="text-xl font-black mb-4 flex items-center gap-2">
              <Bookmark className="h-6 w-6 text-primary" />
              Saved Reels
            </h2>
            
            {savedVideos.length === 0 ? (
              <Card className="p-12 text-center">
                <Bookmark className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No saved videos yet</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Save videos to watch them later!
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {savedVideos.map((video, index) => (
                  <div key={video.id} className="relative group">
                    <div
                      onClick={() => setSelectedVideoIndex(index)}
                      className="aspect-[9/16] rounded-2xl overflow-hidden cursor-pointer hover:scale-105 transition-transform relative"
                    >
                      {/* Video Thumbnail/Cover Photo */}
                      {video.thumbnail_url ? (
                        <img 
                          src={video.thumbnail_url} 
                          alt={video.title}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-accent/20 to-fun-blue/20" />
                      )}
                      
                      {/* Gradient overlay for text readability */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                      
                      {/* Video Title */}
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <p className="text-white text-xs font-bold drop-shadow-lg line-clamp-2">
                          {video.title}
                        </p>
                      </div>
                    </div>
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
            {(profile.user_type === 'creative' ? videos : savedVideos).map((video, index) => (
              <div key={video.id} className="h-screen snap-start relative">
                <VideoPlayer
                  video={{
                    ...video,
                    profiles: {
                      username: profile?.username || '',
                      avatar_url: profile?.avatar_url || '',
                    }
                  }}
                  currentUserId={currentUserId || ''}
                  isPremium={false}
                  onCommentsClick={() => {}}
                  onDelete={video.creator_id === currentUserId ? () => {
                    setSelectedVideoIndex(null);
                    fetchUserVideos(null);
                  } : undefined}
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
