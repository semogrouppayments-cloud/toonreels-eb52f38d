import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import ResponsiveLayout from '@/components/ResponsiveLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  ArrowLeft, Video, Eye, Heart, Users, TrendingUp, Star,
  BarChart3, Upload, Clock, Trophy, ChevronRight, Lock, CheckCircle, Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Milestones logic
interface MilestoneBadge {
  id: string;
  type: 'likes' | 'followers' | 'uploads' | 'views';
  value: number;
  label: string;
  icon: React.ReactNode;
  achieved: boolean;
  color: string;
}

const MILESTONES_STORAGE_KEY = 'toonlyreels_achieved_milestones';

const getAchievedMilestones = (): Record<string, number[]> => {
  try {
    const stored = localStorage.getItem(MILESTONES_STORAGE_KEY);
    return stored ? JSON.parse(stored) : { likes: [], followers: [], uploads: [], views: [] };
  } catch {
    return { likes: [], followers: [], uploads: [], views: [] };
  }
};

interface VideoItem {
  id: string;
  title: string;
  views_count: number;
  likes_count: number;
  created_at: string;
  thumbnail_url: string | null;
}

interface MonetizationData {
  is_eligible: boolean;
  total_stars_earned: number;
  total_withdrawn: number;
  pending_balance: number;
  revenue_split_creator: number;
  revenue_split_platform: number;
}

interface Transaction {
  id: string;
  from_user_id: string | null;
  amount: number;
  type: string;
  created_at: string;
}

const ELIGIBILITY_FOLLOWERS = 5000;
const ELIGIBILITY_WATCH_HOURS = 1000000;

const ToonlyStudio = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'overview';
  const [activeTab, setActiveTab] = useState(initialTab);
  
  // Track navigation history within studio
  const [tabHistory, setTabHistory] = useState<string[]>([initialTab]);
  const [viewingVideoAnalytics, setViewingVideoAnalytics] = useState(false);

  const [userId, setUserId] = useState('');
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [totalViews, setTotalViews] = useState(0);
  const [totalLikes, setTotalLikes] = useState(0);
  const [followers, setFollowers] = useState(0);
  const [totalWatchHours, setTotalWatchHours] = useState(0);
  const [starBalance, setStarBalance] = useState(0);
  const [monetization, setMonetization] = useState<MonetizationData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Milestones state
  const [achievedMilestones, setAchievedMilestones] = useState<Record<string, number[]>>({ likes: [], followers: [], uploads: [], views: [] });

  useEffect(() => {
    loadStudioData();
    setAchievedMilestones(getAchievedMilestones());
  }, []);

  // Sync tab to URL
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSearchParams({ tab });
    setTabHistory(prev => [...prev, tab]);
  };

  // Custom back handler: go to previous tab, or exit studio
  const handleBack = () => {
    if (tabHistory.length > 1) {
      const newHistory = [...tabHistory];
      newHistory.pop(); // remove current
      const prevTab = newHistory[newHistory.length - 1];
      setActiveTab(prevTab);
      setSearchParams({ tab: prevTab });
      setTabHistory(newHistory);
    } else {
      navigate('/feed');
    }
  };

  const loadStudioData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate('/auth'); return; }

    const uid = session.user.id;
    setUserId(uid);

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', uid);

    if (!roles?.some(r => r.role === 'creative')) {
      toast.error('ToonlyStudio is only available for creatives');
      navigate('/profile');
      return;
    }

    const [vidRes, follRes, balRes, monRes, txRes, analyticsRes] = await Promise.all([
      supabase.from('videos').select('id, title, views_count, likes_count, created_at, thumbnail_url').eq('creator_id', uid).order('created_at', { ascending: false }),
      supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', uid),
      supabase.from('star_balances').select('balance').eq('user_id', uid).maybeSingle(),
      supabase.from('creator_monetization').select('*').eq('user_id', uid).maybeSingle(),
      supabase.from('star_transactions').select('*').eq('to_user_id', uid).order('created_at', { ascending: false }).limit(20),
      supabase.from('video_analytics').select('watch_duration, video_id').in('video_id',
        (await supabase.from('videos').select('id').eq('creator_id', uid)).data?.map(v => v.id) || []
      ),
    ]);

    const vids = (vidRes.data as any[]) || [];
    setVideos(vids);
    setTotalViews(vids.reduce((s, v) => s + v.views_count, 0));
    setTotalLikes(vids.reduce((s, v) => s + v.likes_count, 0));
    setFollowers(follRes.count || 0);
    setStarBalance((balRes.data as any)?.balance || 0);
    setMonetization(monRes.data as any);
    setTransactions((txRes.data as any[]) || []);

    const totalSeconds = (analyticsRes.data as any[])?.reduce((s: number, a: any) => s + (a.watch_duration || 0), 0) || 0;
    setTotalWatchHours(Math.round(totalSeconds / 3600));

    setLoading(false);
  };

  const checkEligibility = async () => {
    const eligible = followers >= ELIGIBILITY_FOLLOWERS && totalWatchHours >= ELIGIBILITY_WATCH_HOURS;

    const { data: existing } = await supabase
      .from('creator_monetization')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      await supabase.from('creator_monetization')
        .update({ is_eligible: eligible, eligibility_checked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('user_id', userId);
    } else {
      await supabase.from('creator_monetization')
        .insert({ user_id: userId, is_eligible: eligible });
    }

    setMonetization(prev => prev ? { ...prev, is_eligible: eligible } : {
      is_eligible: eligible, total_stars_earned: 0, total_withdrawn: 0,
      pending_balance: 0, revenue_split_creator: 70, revenue_split_platform: 30,
    });

    toast[eligible ? 'success' : 'info'](eligible ? 'You are eligible for monetization! 🎉' : 'Not eligible yet. Keep growing!');
  };

  const followerProgress = Math.min((followers / ELIGIBILITY_FOLLOWERS) * 100, 100);
  const watchHoursProgress = Math.min((totalWatchHours / ELIGIBILITY_WATCH_HOURS) * 100, 100);

  const chartData = videos.slice(0, 5).map(v => ({
    title: v.title.length > 12 ? v.title.substring(0, 12) + '…' : v.title,
    views: v.views_count,
    likes: v.likes_count,
    engagement: v.views_count > 0 ? Math.round((v.likes_count / v.views_count) * 100) : 0,
  }));

  // Milestones data
  const allMilestones: MilestoneBadge[] = [
    { id: 'likes-1000', type: 'likes', value: 1000, label: '1K Likes', icon: <Heart className="w-5 h-5" />, achieved: achievedMilestones.likes?.includes(1000), color: 'from-red-500 to-pink-500' },
    { id: 'likes-10000', type: 'likes', value: 10000, label: '10K Likes', icon: <Heart className="w-5 h-5" />, achieved: achievedMilestones.likes?.includes(10000), color: 'from-red-500 to-pink-500' },
    { id: 'likes-50000', type: 'likes', value: 50000, label: '50K Likes', icon: <Heart className="w-5 h-5" />, achieved: achievedMilestones.likes?.includes(50000), color: 'from-red-500 to-pink-500' },
    { id: 'likes-100000', type: 'likes', value: 100000, label: '100K Likes', icon: <Heart className="w-5 h-5" />, achieved: achievedMilestones.likes?.includes(100000), color: 'from-red-500 to-pink-500' },
    { id: 'likes-500000', type: 'likes', value: 500000, label: '500K Likes', icon: <Heart className="w-5 h-5" />, achieved: achievedMilestones.likes?.includes(500000), color: 'from-red-500 to-pink-500' },
    { id: 'likes-20000000', type: 'likes', value: 20000000, label: '20M Likes', icon: <Heart className="w-5 h-5" />, achieved: achievedMilestones.likes?.includes(20000000), color: 'from-red-500 to-pink-500' },
    { id: 'views-1000', type: 'views', value: 1000, label: '1K Views', icon: <Eye className="w-5 h-5" />, achieved: achievedMilestones.views?.includes(1000), color: 'from-amber-500 to-yellow-500' },
    { id: 'views-10000', type: 'views', value: 10000, label: '10K Views', icon: <Eye className="w-5 h-5" />, achieved: achievedMilestones.views?.includes(10000), color: 'from-amber-500 to-yellow-500' },
    { id: 'views-100000', type: 'views', value: 100000, label: '100K Views', icon: <Eye className="w-5 h-5" />, achieved: achievedMilestones.views?.includes(100000), color: 'from-amber-500 to-yellow-500' },
    { id: 'views-500000', type: 'views', value: 500000, label: '500K Views', icon: <Eye className="w-5 h-5" />, achieved: achievedMilestones.views?.includes(500000), color: 'from-amber-500 to-yellow-500' },
    { id: 'followers-1000', type: 'followers', value: 1000, label: '1K Followers', icon: <Users className="w-5 h-5" />, achieved: achievedMilestones.followers?.includes(1000), color: 'from-blue-500 to-purple-500' },
    { id: 'followers-10000', type: 'followers', value: 10000, label: '10K Followers', icon: <Users className="w-5 h-5" />, achieved: achievedMilestones.followers?.includes(10000), color: 'from-blue-500 to-purple-500' },
    { id: 'followers-100000', type: 'followers', value: 100000, label: '100K Followers', icon: <Users className="w-5 h-5" />, achieved: achievedMilestones.followers?.includes(100000), color: 'from-blue-500 to-purple-500' },
    { id: 'followers-500000', type: 'followers', value: 500000, label: '500K Followers', icon: <Users className="w-5 h-5" />, achieved: achievedMilestones.followers?.includes(500000), color: 'from-blue-500 to-purple-500' },
    { id: 'uploads-500', type: 'uploads', value: 500, label: '500 Toonz', icon: <Video className="w-5 h-5" />, achieved: achievedMilestones.uploads?.includes(500), color: 'from-green-500 to-emerald-500' },
    { id: 'uploads-1000', type: 'uploads', value: 1000, label: '1K Toonz', icon: <Video className="w-5 h-5" />, achieved: achievedMilestones.uploads?.includes(1000), color: 'from-green-500 to-emerald-500' },
  ];

  const achievedCount = allMilestones.filter(m => m.achieved).length;
  const groupedMilestones = {
    likes: allMilestones.filter(m => m.type === 'likes'),
    views: allMilestones.filter(m => m.type === 'views'),
    followers: allMilestones.filter(m => m.type === 'followers'),
    uploads: allMilestones.filter(m => m.type === 'uploads'),
  };

  if (loading) {
    return (
      <ResponsiveLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </ResponsiveLayout>
    );
  }

  return (
    <ResponsiveLayout>
      <div className="min-h-screen bg-background pb-24 md:pb-8">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={handleBack} className="h-8 w-8 md:hidden">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-lg font-black flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                ToonlyStudio
              </h1>
              <p className="text-xs text-muted-foreground">Your creator command center</p>
            </div>
          </div>
          <Button size="sm" onClick={() => navigate('/upload')} className="gap-1">
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Upload</span>
          </Button>
        </div>

        <div className="max-w-6xl mx-auto p-4 space-y-4">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="w-full grid grid-cols-6">
              <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
              <TabsTrigger value="content" className="text-xs">Content</TabsTrigger>
              <TabsTrigger value="analytics" className="text-xs">Analytics</TabsTrigger>
              <TabsTrigger value="monetize" className="text-xs">Monetize</TabsTrigger>
              <TabsTrigger value="milestones" className="text-xs">Milestones</TabsTrigger>
              <TabsTrigger value="stars" className="text-xs">Stars</TabsTrigger>
            </TabsList>

            {/* ===== OVERVIEW ===== */}
            <TabsContent value="overview" className="mt-4 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Video className="h-4 w-4 text-primary" />
                    <span className="text-xs text-muted-foreground">Toonz</span>
                  </div>
                  <p className="text-2xl font-black">{videos.length}</p>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Eye className="h-4 w-4 text-accent" />
                    <span className="text-xs text-muted-foreground">Total Views</span>
                  </div>
                  <p className="text-2xl font-black">{totalViews.toLocaleString()}</p>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Heart className="h-4 w-4 text-primary" />
                    <span className="text-xs text-muted-foreground">Total Likes</span>
                  </div>
                  <p className="text-2xl font-black">{totalLikes.toLocaleString()}</p>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="h-4 w-4 text-accent" />
                    <span className="text-xs text-muted-foreground">Followers</span>
                  </div>
                  <p className="text-2xl font-black">{followers.toLocaleString()}</p>
                </Card>
              </div>

              <Card className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Total Watch Hours</span>
                </div>
                <p className="text-2xl font-black">{totalWatchHours.toLocaleString()}</p>
              </Card>

              <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-2xl p-4 border border-yellow-500/30">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Star Balance</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Star className="h-6 w-6 text-yellow-500 fill-yellow-500" />
                      <span className="text-3xl font-black">{starBalance.toLocaleString()}</span>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => handleTabChange('stars')} className="gap-1">
                    <Star className="h-4 w-4" />
                    View Stars
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" onClick={() => navigate('/upload')} className="h-auto py-3 flex-col gap-1">
                  <Upload className="h-5 w-5" />
                  <span className="text-xs">Upload Toonz</span>
                </Button>
                <Button variant="outline" onClick={() => navigate('/leaderboard')} className="h-auto py-3 flex-col gap-1">
                  <Trophy className="h-5 w-5" />
                  <span className="text-xs">Leaderboard</span>
                </Button>
              </div>
            </TabsContent>

            {/* ===== CONTENT ===== */}
            <TabsContent value="content" className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-sm">Your Toonz ({videos.length})</h2>
                <Button size="sm" variant="outline" onClick={() => navigate('/upload')} className="gap-1">
                  <Upload className="h-3 w-3" />
                  New
                </Button>
              </div>

              {videos.length === 0 ? (
                <Card className="p-8 text-center">
                  <Video className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">No toonz uploaded yet</p>
                  <Button size="sm" onClick={() => navigate('/upload')} className="mt-3">Upload First Toonz</Button>
                </Card>
              ) : (
                <div className="space-y-2">
                  {videos.map(video => (
                    <button
                      key={video.id}
                      onClick={() => navigate(`/video-analytics/${video.id}`)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-primary/30 transition-all text-left"
                    >
                      <div className="w-16 h-10 rounded-lg bg-muted flex-shrink-0 overflow-hidden">
                        {video.thumbnail_url ? (
                          <img src={video.thumbnail_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Video className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate text-foreground">{video.title}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          <span className="flex items-center gap-0.5"><Eye className="h-3 w-3" />{video.views_count}</span>
                          <span className="flex items-center gap-0.5"><Heart className="h-3 w-3" />{video.likes_count}</span>
                          <span>{new Date(video.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ===== ANALYTICS ===== */}
            <TabsContent value="analytics" className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Card className="p-4">
                  <h3 className="text-xs text-muted-foreground mb-1">Avg Engagement</h3>
                  <p className="text-3xl font-black text-primary">
                    {totalViews > 0 ? Math.round((totalLikes / totalViews) * 100) : 0}%
                  </p>
                </Card>
                <Card className="p-4">
                  <h3 className="text-xs text-muted-foreground mb-1">Watch Hours</h3>
                  <p className="text-3xl font-black text-accent">{totalWatchHours.toLocaleString()}</p>
                </Card>
              </div>

              <Card className="p-4">
                <h3 className="font-bold text-sm mb-3">Top 5 Toonz by Views</h3>
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={chartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                      <YAxis type="category" dataKey="title" stroke="hsl(var(--muted-foreground))" fontSize={11} width={80} />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                      <Bar dataKey="views" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">Upload toonz to see analytics</p>
                )}
              </Card>

              {chartData.length > 0 && (
                <Card className="p-4">
                  <h3 className="font-bold text-sm mb-3">Engagement Rate</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="title" stroke="hsl(var(--muted-foreground))" fontSize={10} angle={-30} textAnchor="end" height={60} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                      <Line type="monotone" dataKey="engagement" stroke="hsl(var(--accent))" strokeWidth={2} dot={{ fill: 'hsl(var(--accent))', r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
              )}
            </TabsContent>

            {/* ===== MONETIZE ===== */}
            <TabsContent value="monetize" className="mt-4 space-y-4">
              <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-2xl p-5 border border-yellow-500/30">
                <p className="text-sm text-muted-foreground mb-1">Your Star Balance</p>
                <div className="flex items-center gap-2">
                  <Star className="h-8 w-8 text-yellow-500 fill-yellow-500" />
                  <span className="text-4xl font-black">{starBalance.toLocaleString()}</span>
                </div>
                {monetization?.is_eligible && (
                  <div className="mt-3 pt-3 border-t border-yellow-500/20 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Pending earnings</span>
                      <span className="font-bold">{monetization.pending_balance} ⭐</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total earned</span>
                      <span className="font-bold">{monetization.total_stars_earned} ⭐</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Revenue split</span>
                      <span className="font-bold text-primary">{monetization.revenue_split_creator}% you / {monetization.revenue_split_platform}% platform</span>
                    </div>
                  </div>
                )}
              </div>

              <Card className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  {monetization?.is_eligible ? <CheckCircle className="h-5 w-5 text-green-500" /> : <Lock className="h-5 w-5 text-muted-foreground" />}
                  <h2 className="font-bold">Monetization Status</h2>
                </div>

                {monetization?.is_eligible ? (
                  <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                    <p className="text-sm font-medium text-green-600 dark:text-green-400">
                      ✅ You're eligible! Stars gifted to you count towards your earnings.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-muted/50 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <p className="text-xs text-muted-foreground">
                          Reach {ELIGIBILITY_FOLLOWERS.toLocaleString()} followers and {ELIGIBILITY_WATCH_HOURS.toLocaleString()} watch hours to start earning from Stars.
                        </p>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Followers</span>
                        <span className="font-medium">{followers.toLocaleString()} / {ELIGIBILITY_FOLLOWERS.toLocaleString()}</span>
                      </div>
                      <Progress value={followerProgress} className="h-2" />
                    </div>

                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Watch Hours</span>
                        <span className="font-medium">{totalWatchHours.toLocaleString()} / {ELIGIBILITY_WATCH_HOURS.toLocaleString()}</span>
                      </div>
                      <Progress value={watchHoursProgress} className="h-2" />
                    </div>

                    <Button onClick={checkEligibility} className="w-full" size="sm">
                      <TrendingUp className="h-4 w-4 mr-1" />
                      Check Eligibility
                    </Button>
                  </div>
                )}
              </Card>

              <Card className="p-5">
                <h2 className="font-bold mb-3">How Stars Work</h2>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <div className="flex gap-3"><span className="text-lg">🌟</span><p>Viewers buy Star packs and send them to creators on toonz they love.</p></div>
                  <div className="flex gap-3"><span className="text-lg">📊</span><p>Reach {ELIGIBILITY_FOLLOWERS.toLocaleString()} followers + {ELIGIBILITY_WATCH_HOURS.toLocaleString()} watch hours to unlock monetization.</p></div>
                  <div className="flex gap-3"><span className="text-lg">💰</span><p>Eligible creators earn 70% of gifted Stars value. Platform keeps 30%.</p></div>
                  <div className="flex gap-3"><span className="text-lg">📈</span><p>Track your earnings and Star gifts in real-time.</p></div>
                </div>
              </Card>
            </TabsContent>

            {/* ===== MILESTONES ===== */}
            <TabsContent value="milestones" className="mt-4 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-lg">Milestone Badges</h2>
                  <p className="text-xs text-muted-foreground">{achievedCount} of {allMilestones.length} achieved</p>
                </div>
                <div className="flex items-center gap-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-3 py-1.5 rounded-full">
                  <Trophy className="w-4 h-4" />
                  <span className="font-bold text-sm">{achievedCount}</span>
                </div>
              </div>

              {Object.entries(groupedMilestones).map(([type, milestones]) => {
                const icons: Record<string, React.ReactNode> = {
                  likes: <Heart className="w-4 h-4 text-red-500" />,
                  views: <Eye className="w-4 h-4 text-amber-500" />,
                  followers: <Users className="w-4 h-4 text-blue-500" />,
                  uploads: <Video className="w-4 h-4 text-green-500" />,
                };
                return (
                  <section key={type}>
                    <div className="flex items-center gap-2 mb-3">
                      {icons[type]}
                      <h3 className="text-sm font-semibold capitalize">{type} Milestones</h3>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {milestones.map((m) => (
                        <Card
                          key={m.id}
                          className={`relative p-3 flex flex-col items-center justify-center aspect-square transition-all duration-300 ${
                            m.achieved
                              ? 'bg-gradient-to-br ' + m.color + ' text-white shadow-lg'
                              : 'bg-muted/50 text-muted-foreground opacity-60'
                          }`}
                        >
                          {!m.achieved && (
                            <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-lg">
                              <Lock className="w-5 h-5 text-muted-foreground" />
                            </div>
                          )}
                          <div className="mb-1">{m.icon}</div>
                          <span className="text-[10px] font-bold text-center leading-tight">{m.label}</span>
                          {m.achieved && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center shadow-md">
                              <span className="text-[8px]">✓</span>
                            </div>
                          )}
                        </Card>
                      ))}
                    </div>
                  </section>
                );
              })}
            </TabsContent>

            {/* ===== STARS ===== */}
            <TabsContent value="stars" className="mt-4 space-y-4">
              <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-2xl p-5 border border-yellow-500/30">
                <p className="text-sm text-muted-foreground mb-1">Your Star Balance</p>
                <div className="flex items-center gap-2">
                  <Star className="h-8 w-8 text-yellow-500 fill-yellow-500" />
                  <span className="text-4xl font-black">{starBalance.toLocaleString()}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 gap-1" onClick={() => navigate('/leaderboard')}>
                  <Trophy className="h-4 w-4" />
                  Leaderboard
                </Button>
              </div>

              <Card className="p-5">
                <h2 className="font-bold mb-3">Recent Star Gifts</h2>
                {transactions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No star gifts yet</p>
                ) : (
                  <div className="space-y-2">
                    {transactions.map(tx => (
                      <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                        <div className="flex items-center gap-2">
                          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                          <span className="text-sm capitalize">{tx.type}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold text-primary">+{tx.amount}</span>
                          <p className="text-[10px] text-muted-foreground">{new Date(tx.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </ResponsiveLayout>
  );
};

export default ToonlyStudio;
