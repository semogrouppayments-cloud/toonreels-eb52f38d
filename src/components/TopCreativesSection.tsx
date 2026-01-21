import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Download, Eye, Heart, Play, Trophy } from 'lucide-react';
import { toast } from 'sonner';

interface TopCreator {
  id: string;
  username: string;
  avatar_url: string | null;
  is_verified: boolean;
  weeklyViews: number;
  weeklyLikes: number;
  videoCount: number;
}

interface TopCreativesSectionProps {
  formatCount: (count: number) => string;
}

const TopCreativesSection = ({ formatCount }: TopCreativesSectionProps) => {
  const navigate = useNavigate();
  const [topCreators, setTopCreators] = useState<TopCreator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    fetchTopCreators();
  }, []);

  const fetchTopCreators = async () => {
    setIsLoading(true);
    
    // Get the start of this week (Monday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const weekStart = new Date(now.setDate(diff));
    weekStart.setHours(0, 0, 0, 0);

    // Fetch videos from this week with their creators
    const { data: videos } = await supabase
      .from('videos')
      .select(`
        creator_id,
        views_count,
        likes_count,
        created_at,
        profiles!videos_creator_id_fkey(id, username, avatar_url, is_verified)
      `)
      .gte('created_at', weekStart.toISOString());

    if (!videos || videos.length === 0) {
      setTopCreators([]);
      setIsLoading(false);
      return;
    }

    // Aggregate stats per creator
    const creatorStats: Record<string, TopCreator> = {};
    
    videos.forEach((video: any) => {
      const profile = video.profiles;
      if (!profile) return;
      
      if (!creatorStats[profile.id]) {
        creatorStats[profile.id] = {
          id: profile.id,
          username: profile.username,
          avatar_url: profile.avatar_url,
          is_verified: profile.is_verified || false,
          weeklyViews: 0,
          weeklyLikes: 0,
          videoCount: 0
        };
      }
      
      creatorStats[profile.id].weeklyViews += video.views_count || 0;
      creatorStats[profile.id].weeklyLikes += video.likes_count || 0;
      creatorStats[profile.id].videoCount += 1;
    });

    // Sort by total engagement (views + likes)
    const sorted = Object.values(creatorStats)
      .sort((a, b) => (b.weeklyViews + b.weeklyLikes) - (a.weeklyViews + a.weeklyLikes))
      .slice(0, 5);

    setTopCreators(sorted);
    setIsLoading(false);
  };

  const generateCreatorCard = async (creator: TopCreator, rank: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 1000;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Background gradient (red to orange)
    const gradient = ctx.createLinearGradient(0, 0, 1000, 1000);
    gradient.addColorStop(0, '#FF0000');
    gradient.addColorStop(0.5, '#F97316');
    gradient.addColorStop(1, '#FFD700');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1000, 1000);

    // Add pattern overlay
    ctx.globalAlpha = 0.1;
    for (let i = 0; i < 20; i++) {
      ctx.beginPath();
      ctx.arc(Math.random() * 1000, Math.random() * 1000, Math.random() * 50 + 20, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Add "This Week's Top Creator" header
    ctx.font = 'bold 48px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText("🏆 This Week's Top Creator 🏆", 500, 80);

    // Rank badge
    ctx.font = 'bold 120px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = rank === 1 ? '#FFD700' : rank === 2 ? '#C0C0C0' : '#CD7F32';
    ctx.fillText(`#${rank}`, 500, 220);

    // Creator name
    ctx.font = 'bold 72px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 10;
    ctx.fillText(`@${creator.username}`, 500, 480);
    ctx.shadowBlur = 0;

    // Stats
    ctx.font = 'bold 56px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(`👁 ${formatCount(creator.weeklyViews)} views`, 500, 600);
    ctx.fillText(`❤️ ${formatCount(creator.weeklyLikes)} likes`, 500, 680);
    ctx.fillText(`🎬 ${creator.videoCount} videos`, 500, 760);

    // Footer with ToonlyReels branding
    ctx.font = 'bold 36px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText('ToonlyReels • Week of ' + new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), 500, 940);

    return canvas.toDataURL('image/png');
  };

  const handlePreview = async (creator: TopCreator, rank: number) => {
    const imageUrl = await generateCreatorCard(creator, rank);
    if (imageUrl) {
      setPreviewImage(imageUrl);
    }
  };

  const handleDownload = async (creator: TopCreator, rank: number) => {
    const imageUrl = await generateCreatorCard(creator, rank);
    if (!imageUrl) {
      toast.error('Failed to generate image');
      return;
    }

    const link = document.createElement('a');
    link.download = `toonlyreels-top-creator-${creator.username}.png`;
    link.href = imageUrl;
    link.click();
    toast.success('Image downloaded!');
  };

  if (isLoading) {
    return (
      <div className="p-4 border-b border-border">
        <div className="h-6 w-48 bg-muted rounded animate-pulse mb-3" />
        <div className="hidden lg:flex gap-3 overflow-x-auto pb-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex-shrink-0 w-40 h-48 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="lg:hidden grid grid-cols-3 gap-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="aspect-square bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (topCreators.length === 0) return null;

  return (
    <>
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
          <Trophy className="h-5 w-5 text-fun-yellow" />
          This Week's Top Creatives
        </h2>
        
        {/* Horizontal scroll on laptop */}
        <div className="hidden lg:flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {topCreators.map((creator, index) => (
            <div
              key={creator.id}
              className="flex-shrink-0 w-40 bg-gradient-to-br from-primary/20 via-accent/20 to-fun-yellow/20 rounded-xl p-3 border border-border hover:border-primary/50 transition-all group"
            >
              {/* Rank Badge */}
              <div className="flex justify-between items-start mb-2">
                <span className={`text-2xl font-bold ${
                  index === 0 ? 'text-fun-yellow' : index === 1 ? 'text-muted-foreground' : 'text-accent'
                }`}>
                  #{index + 1}
                </span>
                {index === 0 && <span className="text-lg">👑</span>}
              </div>

              {/* Avatar */}
              <div 
                className="cursor-pointer mb-2"
                onClick={() => navigate(`/profile?userId=${creator.id}`)}
              >
                <Avatar className="h-16 w-16 mx-auto ring-2 ring-primary/30 group-hover:ring-primary transition-all">
                  <AvatarImage src={creator.avatar_url || undefined} alt={creator.username} />
                  <AvatarFallback className="text-xl font-bold bg-primary text-primary-foreground">
                    {creator.username?.[0]?.toUpperCase() || 'C'}
                  </AvatarFallback>
                </Avatar>
              </div>

              {/* Username */}
              <p 
                className="text-sm font-semibold text-center truncate cursor-pointer hover:text-primary transition-colors"
                onClick={() => navigate(`/profile?userId=${creator.id}`)}
              >
                @{creator.username}
                {creator.is_verified && (
                  <span className="ml-1 text-fun-blue">✓</span>
                )}
              </p>

              {/* Stats */}
              <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
                <div className="flex items-center justify-center gap-1">
                  <Eye className="h-3 w-3" />
                  <span>{formatCount(creator.weeklyViews)}</span>
                </div>
                <div className="flex items-center justify-center gap-1">
                  <Heart className="h-3 w-3" />
                  <span>{formatCount(creator.weeklyLikes)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-2 flex gap-1 justify-center">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onClick={() => handlePreview(creator, index + 1)}
                >
                  <Play className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onClick={() => handleDownload(creator, index + 1)}
                >
                  <Download className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Grid on mobile */}
        <div className="lg:hidden grid grid-cols-3 gap-2">
          {topCreators.slice(0, 3).map((creator, index) => (
            <div
              key={creator.id}
              className="bg-gradient-to-br from-primary/20 via-accent/20 to-fun-yellow/20 rounded-xl p-2 border border-border"
            >
              {/* Rank */}
              <div className="flex justify-between items-center mb-1">
                <span className={`text-lg font-bold ${
                  index === 0 ? 'text-fun-yellow' : index === 1 ? 'text-muted-foreground' : 'text-accent'
                }`}>
                  #{index + 1}
                </span>
                {index === 0 && <span className="text-sm">👑</span>}
              </div>

              {/* Avatar */}
              <div 
                className="cursor-pointer mb-1"
                onClick={() => navigate(`/profile?userId=${creator.id}`)}
              >
                <Avatar className="h-12 w-12 mx-auto ring-2 ring-primary/30">
                  <AvatarImage src={creator.avatar_url || undefined} alt={creator.username} />
                  <AvatarFallback className="text-sm font-bold bg-primary text-primary-foreground">
                    {creator.username?.[0]?.toUpperCase() || 'C'}
                  </AvatarFallback>
                </Avatar>
              </div>

              {/* Username */}
              <p 
                className="text-[10px] font-semibold text-center truncate cursor-pointer"
                onClick={() => navigate(`/profile?userId=${creator.id}`)}
              >
                @{creator.username}
              </p>

              {/* Stats */}
              <div className="mt-1 text-[9px] text-muted-foreground flex justify-center gap-2">
                <span className="flex items-center gap-0.5">
                  <Eye className="h-2.5 w-2.5" />
                  {formatCount(creator.weeklyViews)}
                </span>
                <span className="flex items-center gap-0.5">
                  <Heart className="h-2.5 w-2.5" />
                  {formatCount(creator.weeklyLikes)}
                </span>
              </div>

              {/* Download button */}
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-full mt-1 text-[9px]"
                onClick={() => handleDownload(creator, index + 1)}
              >
                <Download className="h-2.5 w-2.5 mr-1" />
                Save
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Preview Modal */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <img 
              src={previewImage} 
              alt="Creator Card Preview" 
              className="w-full rounded-xl shadow-2xl"
            />
            <div className="mt-4 flex gap-2 justify-center">
              <Button
                onClick={() => {
                  const link = document.createElement('a');
                  link.download = 'toonlyreels-top-creator.png';
                  link.href = previewImage;
                  link.click();
                  toast.success('Image downloaded!');
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button variant="outline" onClick={() => setPreviewImage(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TopCreativesSection;
