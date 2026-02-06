import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Hash, TrendingUp, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface TrendingTag {
  tag: string;
  count: number;
}

interface SuggestedCreator {
  id: string;
  username: string;
  avatar_url: string | null;
  selected_avatar: string | null;
  is_verified: boolean;
  followers_count: number;
}

interface FeedRightSidebarProps {
  currentUserId: string;
  isCreative: boolean;
}

const FeedRightSidebar = ({ currentUserId, isCreative }: FeedRightSidebarProps) => {
  const navigate = useNavigate();
  const [trendingTags, setTrendingTags] = useState<TrendingTag[]>([]);
  const [suggestedCreators, setSuggestedCreators] = useState<SuggestedCreator[]>([]);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [loadingFollow, setLoadingFollow] = useState<string | null>(null);

  useEffect(() => {
    fetchTrendingTags();
    if (!isCreative) {
      fetchSuggestedCreators();
      fetchFollowing();
    }
  }, [currentUserId, isCreative]);

  const fetchTrendingTags = async () => {
    try {
      const { data: videos } = await supabase
        .from('videos')
        .select('tags, views_count')
        .not('tags', 'is', null);

      if (!videos) return;

      const tagCounts: { [key: string]: number } = {};
      videos.forEach(video => {
        if (video.tags) {
          video.tags.forEach((tag: string) => {
            tagCounts[tag] = (tagCounts[tag] || 0) + video.views_count;
          });
        }
      });

      const sorted = Object.entries(tagCounts)
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);

      setTrendingTags(sorted);
    } catch (error) {
      console.error('Error fetching trending tags:', error);
    }
  };

  const fetchSuggestedCreators = async () => {
    try {
      // Get creators with creative role
      const { data: creativeRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'creative')
        .limit(20);

      if (!creativeRoles || creativeRoles.length === 0) return;

      const creatorIds = creativeRoles
        .map(r => r.user_id)
        .filter(id => id !== currentUserId);

      // Get profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, selected_avatar, is_verified')
        .in('id', creatorIds)
        .limit(5);

      if (!profiles) return;

      // Get follower counts
      const creatorsWithFollowers: SuggestedCreator[] = await Promise.all(
        profiles.map(async (profile) => {
          const { count } = await supabase
            .from('follows')
            .select('*', { count: 'exact', head: true })
            .eq('following_id', profile.id);
          
          return {
            ...profile,
            followers_count: count || 0
          };
        })
      );

      setSuggestedCreators(creatorsWithFollowers.sort((a, b) => b.followers_count - a.followers_count));
    } catch (error) {
      console.error('Error fetching suggested creators:', error);
    }
  };

  const fetchFollowing = async () => {
    const { data } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', currentUserId);
    
    setFollowingIds(data?.map(f => f.following_id) || []);
  };

  const handleFollow = async (creatorId: string) => {
    if (!currentUserId) return;
    
    setLoadingFollow(creatorId);
    try {
      const isFollowing = followingIds.includes(creatorId);
      
      if (isFollowing) {
        await supabase
          .from('follows')
          .delete()
          .eq('follower_id', currentUserId)
          .eq('following_id', creatorId);
        
        setFollowingIds(prev => prev.filter(id => id !== creatorId));
        toast.success('Unfollowed');
      } else {
        await supabase
          .from('follows')
          .insert({ follower_id: currentUserId, following_id: creatorId });
        
        setFollowingIds(prev => [...prev, creatorId]);
        toast.success('Following!');
      }
    } catch (error) {
      toast.error('Failed to update follow');
    } finally {
      setLoadingFollow(null);
    }
  };

  const handleTagClick = (tag: string) => {
    navigate(`/search?tag=${encodeURIComponent(tag)}`);
  };

  return (
    <aside className="hidden lg:flex fixed right-0 top-0 bottom-0 w-72 xl:w-80 bg-card border-l border-border flex-col z-40 overflow-y-auto">
      <div className="p-4 space-y-6">
        {/* Trending Hashtags */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h3 className="font-bold text-sm text-foreground">Trending Hashtags</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {trendingTags.map(({ tag }) => (
              <button
                key={tag}
                onClick={() => handleTagClick(tag)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-muted hover:bg-primary hover:text-primary-foreground transition-colors text-xs font-medium"
              >
                <Hash className="h-3 w-3" />
                {tag.length > 12 ? tag.substring(0, 12) + '...' : tag}
              </button>
            ))}
            {trendingTags.length === 0 && (
              <p className="text-xs text-muted-foreground">No trending tags yet</p>
            )}
          </div>
        </div>

        {/* Suggested Creatives - Only for Viewers */}
        {!isCreative && suggestedCreators.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <UserPlus className="h-4 w-4 text-primary" />
              <h3 className="font-bold text-sm text-foreground">Suggested Creatives</h3>
            </div>
            <div className="space-y-3">
              {suggestedCreators.map((creator) => {
                const isFollowing = followingIds.includes(creator.id);
                return (
                  <div key={creator.id} className="flex items-center gap-3">
                    <button
                      onClick={() => navigate(`/profile/${creator.id}`)}
                      className="flex items-center gap-3 flex-1 min-w-0"
                    >
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-lg overflow-hidden flex-shrink-0">
                        {creator.avatar_url ? (
                          <img src={creator.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          creator.selected_avatar || '🦊'
                        )}
                      </div>
                      <div className="min-w-0 text-left">
                        <p className="font-semibold text-sm text-foreground truncate flex items-center gap-1">
                          {creator.username}
                          {creator.is_verified && (
                            <span className="text-primary text-xs">✓</span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {creator.followers_count.toLocaleString()} followers
                        </p>
                      </div>
                    </button>
                    <Button
                      size="sm"
                      variant={isFollowing ? "outline" : "default"}
                      onClick={() => handleFollow(creator.id)}
                      disabled={loadingFollow === creator.id}
                      className="text-xs px-3 h-8"
                    >
                      {isFollowing ? 'Following' : 'Follow'}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* For Creatives - Just show hashtags info */}
        {isCreative && (
          <div className="p-4 rounded-xl bg-muted/50">
            <p className="text-xs text-muted-foreground">
              Use trending hashtags on your videos to increase discoverability!
            </p>
          </div>
        )}
      </div>
    </aside>
  );
};

export default FeedRightSidebar;
