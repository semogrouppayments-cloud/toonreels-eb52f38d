import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search as SearchIcon, Play, Heart, Eye } from 'lucide-react';
import BottomNav from '@/components/BottomNav';


const CATEGORIES = [
  { id: 'all', label: 'All', emoji: '🎬' },
  { id: 'comedy', label: 'Comedy', emoji: '😂' },
  { id: 'adventure', label: 'Adventure', emoji: '🚀' },
  { id: 'learning', label: 'Learning', emoji: '📚' },
  { id: 'music', label: 'Music', emoji: '🎵' },
  { id: 'animals', label: 'Animals', emoji: '🐾' },
  { id: 'superheroes', label: 'Heroes', emoji: '🦸' },
  { id: 'fairytales', label: 'Fairytales', emoji: '🏰' },
];

interface Video {
  id: string;
  title: string;
  description: string;
  thumbnail_url: string | null;
  video_url: string;
  likes_count: number;
  views_count: number;
  tags: string[] | null;
  creator_id: string;
  profiles: {
    username: string;
    avatar_url: string;
  };
}

interface CreatorResult {
  id: string;
  username: string;
  avatar_url: string | null;
  user_type: 'viewer' | 'creative';
}

const normalizeSearch = (raw: string) => raw.trim().replace(/^@/, '');

const Search = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [videos, setVideos] = useState<Video[]>([]);
  const [trendingVideos, setTrendingVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [creatorResults, setCreatorResults] = useState<CreatorResult[]>([]);
  const [showCreatorResults, setShowCreatorResults] = useState(false);
  const [currentUserType, setCurrentUserType] = useState<'viewer' | 'creative' | null>(null);

  // Fetch current user type
  useEffect(() => {
    const fetchCurrentUserType = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('user_type')
          .eq('id', user.id)
          .maybeSingle();
        if (profile) {
          setCurrentUserType(profile.user_type as 'viewer' | 'creative');
        }
      }
    };
    fetchCurrentUserType();
  }, []);

  useEffect(() => {
    fetchVideos();
    fetchTrendingVideos();
  }, [selectedCategory]);

  useEffect(() => {
    const term = normalizeSearch(searchQuery);

    // Only show creator suggestions for normal text searches (not hashtags)
    if (!term || term.startsWith('#')) {
      setCreatorResults([]);
      setShowCreatorResults(false);
      return;
    }

    const t = window.setTimeout(async () => {
      // Both Creatives and Viewers can only search Creatives
      const { data } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, user_type')
        .eq('user_type', 'creative')
        .ilike('username', `%${term}%`)
        .limit(6);

      setCreatorResults((data as CreatorResult[]) || []);
      setShowCreatorResults(true);
    }, 200);

    return () => window.clearTimeout(t);
  }, [searchQuery]);

  const fetchTrendingVideos = async () => {
    const { data } = await supabase
      .from('videos')
      .select(`
        *,
        profiles(username, avatar_url)
      `)
      .order('views_count', { ascending: false })
      .limit(6);
    setTrendingVideos(data || []);
  };

  const fetchVideos = async () => {
    setIsLoading(true);
    let query = supabase
      .from('videos')
      .select(`
        *,
        profiles(username, avatar_url)
      `)
      .order('created_at', { ascending: false });

    // Filter by category/tag if not "all"
    if (selectedCategory !== 'all') {
      query = query.contains('tags', [selectedCategory]);
    }

    const { data } = await query;
    setVideos(data || []);
    setIsLoading(false);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      fetchVideos();
      return;
    }

    setIsLoading(true);
    setHasSearched(true);

    // Search by title, description, creator username, or tags (including hashtags)
    const searchTerm = normalizeSearch(searchQuery).toLowerCase().replace('#', '');

    const { data } = await supabase
      .from('videos')
      .select(`
        *,
        profiles(username, avatar_url)
      `)
      .or(
        `title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,profiles.username.ilike.%${searchTerm}%`
      )
      .order('created_at', { ascending: false });

    // Also filter by tags if search includes hashtag
    let results = data || [];
    if (searchQuery.startsWith('#')) {
      const { data: tagResults } = await supabase
        .from('videos')
        .select(`
          *,
          profiles(username, avatar_url)
        `)
        .contains('tags', [searchTerm])
        .order('created_at', { ascending: false });
      
      // Merge results and remove duplicates
      const allResults = [...results, ...(tagResults || [])];
      results = allResults.filter((v, i, arr) => arr.findIndex(x => x.id === v.id) === i);
    }

    setVideos(results);
    setIsLoading(false);
  };

  const handleVideoClick = (videoId: string) => {
    // Navigate to feed with specific video
    navigate(`/feed?video=${videoId}`);
  };

  const formatCount = (count: number): string => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header with Logo */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="p-4">
          
          
          {/* Search Bar */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search creators, videos, #hashtags..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setHasSearched(false);
                }}
                onFocus={() => setShowCreatorResults(true)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10 bg-muted border-0 rounded-full"
              />

              {showCreatorResults && creatorResults.length > 0 && !searchQuery.trim().startsWith('#') && (
                <div className="absolute left-0 right-0 mt-2 rounded-xl border border-border bg-card shadow-lg overflow-hidden z-50">
                  {creatorResults.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        navigate(`/profile?userId=${c.id}`);
                        setShowCreatorResults(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-accent/50 transition-colors"
                    >
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={c.avatar_url || undefined} alt={`${c.username} profile picture`} />
                        <AvatarFallback className="text-[10px] font-bold">
                          {c.username?.[0]?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground truncate">{c.username}</p>
                        <p className="text-[11px] text-muted-foreground truncate">Creative</p>
                      </div>
                      <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                        Creative
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Button 
              onClick={handleSearch}
              className="rounded-full px-6"
            >
              Search
            </Button>
          </div>
        </div>

        {/* Category Pills */}
        <div className="px-4 pb-3 overflow-x-auto scrollbar-hide">
          <div className="flex gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedCategory(cat.id);
                  setSearchQuery('');
                  setHasSearched(false);
                }}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full whitespace-nowrap transition-all text-sm font-medium ${
                  selectedCategory === cat.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                <span>{cat.emoji}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Trending Section */}
      {!hasSearched && selectedCategory === 'all' && trendingVideos.length > 0 && (
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
            🔥 Trending Now
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {trendingVideos.slice(0, 3).map((video) => (
              <div
                key={video.id}
                onClick={() => handleVideoClick(video.id)}
                className="relative aspect-[9/16] bg-muted rounded-lg overflow-hidden cursor-pointer group"
              >
                {video.thumbnail_url ? (
                  <img src={video.thumbnail_url} alt={video.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                    <Play className="h-6 w-6 text-primary/50" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Play className="h-6 w-6 text-white fill-white" />
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/80 to-transparent">
                  <div className="flex items-center gap-1 text-white/90 text-[10px]">
                    <Eye className="h-2.5 w-2.5" />
                    {formatCount(video.views_count)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      <div className="p-4">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="aspect-[9/16] bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : videos.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              {hasSearched ? 'No videos found for your search' : 'No videos in this category yet'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {videos.map((video) => (
              <div
                key={video.id}
                onClick={() => handleVideoClick(video.id)}
                className="relative aspect-[9/16] bg-muted rounded-xl overflow-hidden cursor-pointer group"
              >
                {/* Thumbnail */}
                {video.thumbnail_url ? (
                  <img
                    src={video.thumbnail_url}
                    alt={video.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                    <Play className="h-8 w-8 text-primary/50" />
                  </div>
                )}

                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="bg-white/20 backdrop-blur-sm rounded-full p-3">
                    <Play className="h-8 w-8 text-white fill-white" />
                  </div>
                </div>

                {/* Video info */}
                <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                  <p className="text-white text-xs font-medium line-clamp-2 mb-1">
                    {video.description || video.title}
                  </p>
                  <div className="flex items-center gap-2 text-white/80 text-xs">
                    <span className="flex items-center gap-0.5">
                      <Eye className="h-3 w-3" />
                      {formatCount(video.views_count)}
                    </span>
                    <span className="flex items-center gap-0.5">
                      <Heart className="h-3 w-3" />
                      {formatCount(video.likes_count)}
                    </span>
                  </div>
                </div>

                {/* Tags */}
                {video.tags && video.tags.length > 0 && (
                  <div className="absolute top-2 left-2 right-2 flex flex-wrap gap-1">
                    {video.tags.slice(0, 2).map((tag, i) => (
                      <span
                        key={i}
                        className="bg-black/50 backdrop-blur-sm text-white text-[10px] px-1.5 py-0.5 rounded-full"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default Search;
