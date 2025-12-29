import { useNavigate } from "react-router-dom";
import { ArrowLeft, Moon, Sun, RefreshCw } from "lucide-react";
import { usePWAUpdate } from "@/hooks/usePWAUpdate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import BottomNav from "@/components/BottomNav";
import { useTheme } from "@/contexts/ThemeContext";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Settings = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { updateAvailable, checking, checkForUpdates, applyUpdate } = usePWAUpdate();
  
  const [username, setUsername] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState("🦊");
  const [ageRange, setAgeRange] = useState("7-9");
  const [profilePin, setProfilePin] = useState("");
  const [cartoonOnlyMode, setCartoonOnlyMode] = useState(true);
  const [contentCategories, setContentCategories] = useState<string[]>(["comedy", "adventure", "learning", "music"]);
  const [commentsVisibility, setCommentsVisibility] = useState("emoji_only");
  const [interactionLimits, setInteractionLimits] = useState(true);
  const [screenTimeLimit, setScreenTimeLimit] = useState(60);
  const [schoolHoursLock, setSchoolHoursLock] = useState(false);
  const [bedtimeLock, setBedtimeLock] = useState(false);
  const [parentalPin, setParentalPin] = useState("");
  const [autoplay, setAutoplay] = useState(true);
  const [videoQuality, setVideoQuality] = useState("auto");
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(false);
  const [subtitlesSize, setSubtitlesSize] = useState("medium");
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [totalViews, setTotalViews] = useState(0);
  const [totalLikes, setTotalLikes] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [videosCount, setVideosCount] = useState(0);
  const [notifLikes, setNotifLikes] = useState(true);
  const [notifComments, setNotifComments] = useState(true);
  const [notifFollows, setNotifFollows] = useState(true);
  const [notifReplies, setNotifReplies] = useState(true);
  const [notifPush, setNotifPush] = useState(false);
  const [notifSound, setNotifSound] = useState(true);
  const [isCreative, setIsCreative] = useState(false);

  useEffect(() => {
    fetchUserSettings();
  }, []);

  const fetchUserSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      
      // Check if user is creative
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      setIsCreative(roles?.some(r => r.role === 'creative') || false);
      
      const { data: profile } = await supabase.from('profiles').select('username, selected_avatar, age_range').eq('id', user.id).single();
      if (profile) {
        setUsername(profile.username || "");
        setSelectedAvatar(profile.selected_avatar || "🦊");
        setAgeRange(profile.age_range || "7-9");
      }
      
      // Fetch profile PIN from secure table
      const { data: profileSecrets } = await supabase.from('profile_secrets').select('profile_pin').eq('user_id', user.id).single();
      if (profileSecrets) {
        setProfilePin(profileSecrets.profile_pin || "");
      }
      
      const { data: contentSettings } = await supabase.from('content_settings').select('*').eq('user_id', user.id).single();
      if (contentSettings) {
        setCartoonOnlyMode(contentSettings.cartoon_only_mode);
        setContentCategories(contentSettings.content_categories || []);
        setCommentsVisibility(contentSettings.comments_visibility);
        setInteractionLimits(contentSettings.interaction_limits);
      }
      
      const { data: parentalControls } = await supabase.from('parental_controls').select('*').eq('user_id', user.id).single();
      if (parentalControls) {
        setScreenTimeLimit(parentalControls.screen_time_limit);
        setSchoolHoursLock(parentalControls.school_hours_lock);
        setBedtimeLock(parentalControls.bedtime_lock);
        setParentalPin(parentalControls.parental_pin || "");
      }
      
      const { data: playbackSettings } = await supabase.from('playback_settings').select('*').eq('user_id', user.id).single();
      if (playbackSettings) {
        setAutoplay(playbackSettings.autoplay);
        setVideoQuality(playbackSettings.video_quality);
        setSubtitlesEnabled(playbackSettings.subtitles_enabled);
        setSubtitlesSize(playbackSettings.subtitles_size);
      }

      const { data: notifPrefs } = await supabase.from('notification_preferences').select('*').eq('user_id', user.id).single();
      if (notifPrefs) {
        setNotifLikes(notifPrefs.likes_enabled);
        setNotifComments(notifPrefs.comments_enabled);
        setNotifFollows(notifPrefs.follows_enabled);
        setNotifReplies(notifPrefs.replies_enabled);
        setNotifPush(notifPrefs.push_enabled);
        setNotifSound(notifPrefs.sound_enabled);
      }
      
      // Fetch user stats
      const { data: videos } = await supabase.from('videos').select('views_count, likes_count').eq('creator_id', user.id);
      if (videos) {
        const views = videos.reduce((sum, v) => sum + v.views_count, 0);
        const likes = videos.reduce((sum, v) => sum + v.likes_count, 0);
        setTotalViews(views);
        setTotalLikes(likes);
        setVideosCount(videos.length);
      }

      const { count: followers } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', user.id);
      setFollowersCount(followers || 0);
      
      setLoading(false);
    } catch (error) {
      console.error('Error:', error);
      setLoading(false);
    }
  };

  const saveProfileSettings = async () => {
    if (!userId) return;
    try {
      const updates: any = { username, selected_avatar: selectedAvatar, age_range: ageRange };
      
      await supabase.from('profiles').update(updates).eq('id', userId);
      
      // Save PIN using server-side hashing
      if (profilePin && profilePin.trim()) {
        const { error } = await supabase.rpc('set_profile_pin', {
          _user_id: userId,
          _raw_pin: profilePin.trim()
        });
        if (error) throw error;
      }
      
      toast.success('Profile settings saved');
    } catch (error) {
      toast.error('Failed to save');
    }
  };

  const saveContentSettings = async () => {
    if (!userId) return;
    try {
      await supabase.from('content_settings').upsert({ user_id: userId, cartoon_only_mode: cartoonOnlyMode, content_categories: contentCategories, comments_visibility: commentsVisibility, interaction_limits: interactionLimits });
      toast.success('Content settings saved');
    } catch (error) {
      toast.error('Failed to save');
    }
  };

  const saveParentalControls = async () => {
    if (!userId) return;
    try {
      const updates: any = { user_id: userId, screen_time_limit: screenTimeLimit, school_hours_lock: schoolHoursLock, bedtime_lock: bedtimeLock };
      
      // Save other settings first (without PIN)
      await supabase.from('parental_controls').upsert(updates);
      
      // Save PIN using server-side hashing if provided
      if (parentalPin && parentalPin.trim()) {
        const { error } = await supabase.rpc('set_parental_pin', {
          _user_id: userId,
          _raw_pin: parentalPin.trim()
        });
        if (error) throw error;
      }
      
      toast.success('Parental controls saved');
    } catch (error) {
      toast.error('Failed to save');
    }
  };

  const savePlaybackSettings = async () => {
    if (!userId) return;
    try {
      await supabase.from('playback_settings').upsert({ user_id: userId, autoplay, video_quality: videoQuality, subtitles_enabled: subtitlesEnabled, subtitles_size: subtitlesSize });
      toast.success('Playback settings saved');
    } catch (error) {
      toast.error('Failed to save');
    }
  };

  const saveNotificationSettings = async () => {
    if (!userId) return;
    try {
      await supabase.from('notification_preferences').upsert({ 
        user_id: userId, 
        likes_enabled: notifLikes,
        comments_enabled: notifComments,
        follows_enabled: notifFollows,
        replies_enabled: notifReplies,
        push_enabled: notifPush,
        sound_enabled: notifSound
      });
      toast.success('Notification settings saved');
      
      // Request push notification permission if enabled
      if (notifPush && 'Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
      }
    } catch (error) {
      toast.error('Failed to save');
    }
  };

  const handleDeleteAccount = async () => {
    try {
      const deleteToast = toast.loading("Deleting account...");
      
      // Call the edge function to delete all user data
      const { data, error } = await supabase.functions.invoke('delete-account');
      
      if (error) {
        toast.error("Failed to delete account", { id: deleteToast });
        throw error;
      }

      toast.success("Account deleted successfully", { id: deleteToast });
      navigate('/auth');
    } catch (error: any) {
      console.error('Delete account error:', error);
      toast.error(error.message || "Failed to delete account");
    }
  };

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><p>Loading...</p></div>;

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-4xl mx-auto p-4">
        <div className="mb-6 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/profile')} className="rounded-full"><ArrowLeft className="h-6 w-6" /></Button>
          <h1 className="text-2xl font-black">ToonReels Settings</h1>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Account & Profile</CardTitle></CardHeader>
            <CardContent>
              <Accordion type="single" collapsible>
                <AccordionItem value="profile">
                  <AccordionTrigger>Profile Name & Avatar</AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    <div className="space-y-2"><Label>Username</Label><Input value={username} onChange={(e) => setUsername(e.target.value)} /></div>
                    <div className="space-y-2"><Label>Avatar</Label>
                      <Select value={selectedAvatar} onValueChange={setSelectedAvatar}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="🦊">🦊 Fox</SelectItem>
                          <SelectItem value="🐱">🐱 Cat</SelectItem>
                          <SelectItem value="🐻">🐻 Bear</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={saveProfileSettings}>Save</Button>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="age">
                  <AccordionTrigger>Age Range</AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    <Select value={ageRange} onValueChange={setAgeRange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7-9">7-9 years</SelectItem>
                        <SelectItem value="10-12">10-12 years</SelectItem>
                        <SelectItem value="13-15">13-15 years</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={saveProfileSettings}>Save</Button>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="theme">
                  <AccordionTrigger>Theme</AccordionTrigger>
                  <AccordionContent>
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">{theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}{theme === "dark" ? "Dark" : "Light"}</Label>
                      <Switch checked={theme === "dark"} onCheckedChange={toggleTheme} />
                    </div>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="pin">
                  <AccordionTrigger>Profile PIN</AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    <Input type="password" maxLength={4} value={profilePin} onChange={(e) => setProfilePin(e.target.value.replace(/\D/g, ''))} placeholder="••••" />
                    <Button onClick={saveProfileSettings}>Save PIN</Button>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Safety & Content</CardTitle></CardHeader>
            <CardContent>
              <Accordion type="single" collapsible>
                <AccordionItem value="cartoon">
                  <AccordionTrigger>Cartoon-Only Mode</AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    <div className="flex justify-between"><Label>Enabled</Label><Switch checked={cartoonOnlyMode} onCheckedChange={setCartoonOnlyMode} /></div>
                    <Button onClick={saveContentSettings}>Save</Button>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="categories">
                  <AccordionTrigger>Categories</AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    {['comedy', 'adventure', 'learning', 'music'].map(cat => (
                      <div key={cat} className="flex justify-between"><Label className="capitalize">{cat}</Label>
                        <Switch checked={contentCategories.includes(cat)} onCheckedChange={(c) => c ? setContentCategories([...contentCategories, cat]) : setContentCategories(contentCategories.filter(x => x !== cat))} />
                      </div>
                    ))}
                    <Button onClick={saveContentSettings}>Save</Button>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Parental Controls</CardTitle></CardHeader>
            <CardContent>
              <Accordion type="single" collapsible>
                <AccordionItem value="screen">
                  <AccordionTrigger>Screen Time</AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    <Input type="number" value={screenTimeLimit} onChange={(e) => setScreenTimeLimit(parseInt(e.target.value) || 0)} />
                    <Button onClick={saveParentalControls}>Save</Button>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="school">
                  <AccordionTrigger>School Hours Lock</AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    <div className="flex justify-between"><Label>Enabled</Label><Switch checked={schoolHoursLock} onCheckedChange={setSchoolHoursLock} /></div>
                    <Button onClick={saveParentalControls}>Save</Button>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Playback</CardTitle></CardHeader>
            <CardContent>
              <Accordion type="single" collapsible>
                <AccordionItem value="autoplay">
                  <AccordionTrigger>Autoplay</AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    <div className="flex justify-between"><Label>Enabled</Label><Switch checked={autoplay} onCheckedChange={setAutoplay} /></div>
                    <Button onClick={savePlaybackSettings}>Save</Button>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="quality">
                  <AccordionTrigger>Video Quality</AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    <Select value={videoQuality} onValueChange={setVideoQuality}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Auto</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={savePlaybackSettings}>Save</Button>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="stats">
                  <AccordionTrigger>Your Stats</AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-background/20 backdrop-blur-md rounded-2xl p-3 border border-border shadow-lg">
                        <p className="text-2xl font-black text-foreground">{totalViews}</p>
                        <p className="text-xs text-muted-foreground font-semibold">Views</p>
                      </div>
                      <div className="bg-background/20 backdrop-blur-md rounded-2xl p-3 border border-border shadow-lg">
                        <p className="text-2xl font-black text-foreground">{totalLikes}</p>
                        <p className="text-xs text-muted-foreground font-semibold">Likes</p>
                      </div>
                      <div className="bg-background/20 backdrop-blur-md rounded-2xl p-3 border border-border shadow-lg">
                        <p className="text-2xl font-black text-foreground">{followersCount}</p>
                        <p className="text-xs text-muted-foreground font-semibold">Followers</p>
                      </div>
                      <div className="bg-background/20 backdrop-blur-md rounded-2xl p-3 border border-border shadow-lg">
                        <p className="text-2xl font-black text-foreground">{videosCount}</p>
                        <p className="text-xs text-muted-foreground font-semibold">Videos</p>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Notifications</CardTitle></CardHeader>
            <CardContent>
              <Accordion type="single" collapsible>
                <AccordionItem value="notification-types">
                  <AccordionTrigger>Notification Types</AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    <div className="flex justify-between"><Label>Likes</Label><Switch checked={notifLikes} onCheckedChange={setNotifLikes} /></div>
                    <div className="flex justify-between"><Label>Comments</Label><Switch checked={notifComments} onCheckedChange={setNotifComments} /></div>
                    <div className="flex justify-between"><Label>Follows</Label><Switch checked={notifFollows} onCheckedChange={setNotifFollows} /></div>
                    <div className="flex justify-between"><Label>Replies</Label><Switch checked={notifReplies} onCheckedChange={setNotifReplies} /></div>
                    <Button onClick={saveNotificationSettings}>Save</Button>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="notification-settings">
                  <AccordionTrigger>Notification Settings</AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    <div className="flex justify-between"><Label>Push Notifications</Label><Switch checked={notifPush} onCheckedChange={setNotifPush} /></div>
                    <div className="flex justify-between"><Label>Sound</Label><Switch checked={notifSound} onCheckedChange={setNotifSound} /></div>
                    <Button onClick={saveNotificationSettings}>Save</Button>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>App Updates</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Keep ToonReels up to date for the best experience and latest features.
                </p>
                {updateAvailable ? (
                  <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                    <p className="text-sm font-semibold text-primary mb-2">New version available!</p>
                    <Button onClick={() => applyUpdate()} className="w-full">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Update Now
                    </Button>
                  </div>
                ) : (
                  <Button 
                    onClick={checkForUpdates} 
                    disabled={checking}
                    variant="outline" 
                    className="w-full"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${checking ? 'animate-spin' : ''}`} />
                    {checking ? 'Checking...' : 'Check for Updates'}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>FAQ</CardTitle></CardHeader>
            <CardContent>
              <Accordion type="single" collapsible>
                <AccordionItem value="what">
                  <AccordionTrigger>What is ToonReels?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm text-muted-foreground">ToonReels is a kid-safe cartoon reels platform made by SE-Motoons. Kids can watch short animated clips, music toons, fun stories, and educational shorts — all age filtered.</p>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="cartoon">
                  <AccordionTrigger>Why only cartoon content?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm text-muted-foreground">ToonReels is designed strictly for kids. We automatically block adult themes, scary content, violence, political content, and anything unsafe.</p>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="report">
                  <AccordionTrigger>How do I report something inappropriate?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm text-muted-foreground mb-2">Tap the Report button on any reel or any creator's profile. Our moderation team reviews reports within 24–72 hours.</p>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="comments">
                  <AccordionTrigger>Are comments safe?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm text-muted-foreground">Comments are filtered with AI kid-safe moderation, keyword blocking, and human review for flagged comments. Parents can disable comments completely in Settings → Parental Controls.</p>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="messaging">
                  <AccordionTrigger>Can kids message each other?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm text-muted-foreground">Messaging is off by default. Parents can enable limited messaging after setting a Parent PIN.</p>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="uploads">
                  <AccordionTrigger>How do uploads work?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm text-muted-foreground">Creators can upload reels from the Upload tab. All uploads are reviewed before being public.</p>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="download">
                  <AccordionTrigger>Why can't I download reels?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm text-muted-foreground">Downloading reel videos is a premium feature.</p>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="delete">
                  <AccordionTrigger>How do I delete my account?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm text-muted-foreground">To delete your account, go to <span className="font-semibold">Settings → Privacy Center</span>, scroll down, and click the <span className="font-semibold text-destructive">"Delete Account"</span> button. You'll be asked to confirm before your account is permanently deleted. This action cannot be undone and will remove all your videos, likes, comments, and followers.</p>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="contact">
                  <AccordionTrigger>How do I contact ToonReels?</AccordionTrigger>
                  <AccordionContent>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>Email: info@se-motoons.com</p>
                      <p>Website: www.semotoons.com</p>
                      <p>App Icon: TR (ToonReels official avatar)</p>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Terms of Use</CardTitle></CardHeader>
            <CardContent>
              <Accordion type="single" collapsible>
                <AccordionItem value="terms">
                  <AccordionTrigger>View Terms</AccordionTrigger>
                  <AccordionContent className="space-y-3 text-sm text-muted-foreground">
                    <p className="font-semibold">Last updated: 2025</p>
                    <p>Welcome to ToonReels, a kid-friendly cartoon reels app created by SE-Motoons. By using ToonReels, you agree to these Terms of Use.</p>
                    
                    <div>
                      <p className="font-semibold text-foreground">1. Eligibility</p>
                      <p>ToonReels is designed for users ages 4–15. Parents/guardians must supervise younger users.</p>
                    </div>

                    <div>
                      <p className="font-semibold text-foreground">2. Account Responsibilities</p>
                      <p>You must provide accurate profile information. Parents are responsible for supervising accounts created for children. You must not impersonate others or create misleading profiles.</p>
                    </div>

                    <div>
                      <p className="font-semibold text-foreground">3. Kid-Safe Community Rules</p>
                      <p>You may not upload or share: adult content, violence/gore/scary material, hate speech, bullying/harassment, political content, harmful challenges/dares, or unsafe products/services. Violation may result in content removal or account suspension.</p>
                    </div>

                    <div>
                      <p className="font-semibold text-foreground">4. Content Ownership</p>
                      <p>You keep ownership of your uploaded reels, but you give ToonReels permission to store, display, moderate, and distribute within the app. We NEVER sell user data or videos.</p>
                    </div>

                    <div>
                      <p className="font-semibold text-foreground">5. Moderation</p>
                      <p>We may review content, remove unsafe uploads, and suspend creators who post harmful material. All reports are reviewed within 24–72 hours.</p>
                    </div>

                    <div>
                      <p className="font-semibold text-foreground">6. Premium Features</p>
                      <p>Premium subscriptions allow downloading reels, removing ads, and unlocking exclusive content. Subscriptions auto-renew unless turned off through app settings.</p>
                    </div>

                    <div>
                      <p className="font-semibold text-foreground">7. Termination</p>
                      <p>We may limit or disable accounts that violate safety rules, upload harmful content, or attempt to bypass parental controls.</p>
                    </div>

                    <div>
                      <p className="font-semibold text-foreground">8. Contact</p>
                      <p>Email: info@se-motoons.com | Website: www.semotoons.com | App icon/logo: TR</p>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Privacy Center</CardTitle></CardHeader>
            <CardContent>
              <Accordion type="single" collapsible>
                <AccordionItem value="privacy">
                  <AccordionTrigger>View Privacy Policy</AccordionTrigger>
                  <AccordionContent className="space-y-3 text-sm text-muted-foreground">
                    <p className="font-semibold">ToonReels is COPPA-compliant and designed for child safety.</p>
                    
                    <div>
                      <p className="font-semibold text-foreground">1. What information we collect</p>
                      <p>We collect minimal data: profile name/nickname, avatar (emojis), age range (not exact birth date), parent/guardian email (optional), and uploaded content.</p>
                      <p className="mt-2">We do NOT collect: exact addresses, phone numbers, legal names, financial data, or facial recognition data</p>
                    </div>

                    <div>
                      <p className="font-semibold text-foreground">2. How data is used</p>
                      <p>We use your data to keep content age-appropriate, personalize recommendations, improve safety, and support your account. We do not sell data to advertisers or third parties.</p>
                    </div>

                    <div>
                      <p className="font-semibold text-foreground">3. Data for Kids Under 13</p>
                      <p>Parents can delete data, ask for account export, restrict features (comments, messages, uploads), and set time limits.</p>
                    </div>

                    <div>
                      <p className="font-semibold text-foreground">4. Cookies & Local Storage</p>
                      <p>Used only for saving login state, parental PIN access, and safe viewing history. No tracking across other apps or websites.</p>
                    </div>

                    <div>
                      <p className="font-semibold text-foreground">5. Deleting Your Data</p>
                      <p>You may request deletion anytime by emailing: info@se-motoons.com</p>
                    </div>

                    <div>
                      <p className="font-semibold text-foreground">6. Security</p>
                      <p>We use encryption, secure storage, and safety auditing. No system is 100% secure, but we take strong measures to protect children.</p>
                    </div>

                    <div className="pt-4 border-t">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" className="w-full">
                            Delete Account
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure you want to delete your account?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will permanently delete your account and remove all your data including videos, likes, comments, and followers from our servers.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteAccount} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Yes, Delete My Account
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>User Safety Guide</CardTitle></CardHeader>
            <CardContent>
              <Accordion type="single" collapsible>
                <AccordionItem value="safety">
                  <AccordionTrigger>View Safety Guide</AccordionTrigger>
                  <AccordionContent className="space-y-3 text-sm text-muted-foreground">
                    <p className="font-semibold">ToonReels is built around kid safety first.</p>
                    
                    <div>
                      <p className="font-semibold text-foreground">1. Safe Content System</p>
                      <p>We use AI detection for harmful videos, human moderation, strict cartoon-only rules, and automatic age filtering.</p>
                    </div>

                    <div>
                      <p className="font-semibold text-foreground">2. Reporting Bad Content</p>
                      <p>If something seems wrong, tap the Report button on a reel or the Report Creator button on a profile. Reports are checked within 24–72 hours.</p>
                    </div>

                    <div>
                      <p className="font-semibold text-foreground">3. Parental Controls (PIN-Protected)</p>
                      <p>Parents can set screen time limits, bedtime mode, comment restrictions, messaging restrictions, age filters, and upload permissions.</p>
                    </div>

                    <div>
                      <p className="font-semibold text-foreground">4. Messaging Safety</p>
                      <p>Messaging is disabled by default, optional for older kids, monitored by automated filters, and PIN-protected for parents.</p>
                    </div>

                    <div>
                      <p className="font-semibold text-foreground">5. Comment Safety</p>
                      <p>Comments are filtered to remove bullying, threats, adult themes, spam, and personal info. Parents can also turn off comments entirely.</p>
                    </div>

                    <div>
                      <p className="font-semibold text-foreground">6. Creator Upload Safety</p>
                      <p>All uploads go through automated filtering and human moderator review with age-range tagging. Creators lose upload access if they violate rules.</p>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Help Center</CardTitle></CardHeader>
            <CardContent>
              <Accordion type="single" collapsible>
                <AccordionItem value="support">
                  <AccordionTrigger>General Support</AccordionTrigger>
                  <AccordionContent>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>Email: info@se-motoons.com</p>
                      <p>Website: www.semotoons.com</p>
                    </div>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="loading">
                  <AccordionTrigger>What should I do if a reel won't load?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm text-muted-foreground">Try refreshing your internet, closing & reopening the app, or restarting your device.</p>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="upload-help">
                  <AccordionTrigger>How do I upload a reel?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm text-muted-foreground">Go to Upload → Select Thumbnail → Add Title → Submit.</p>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="protection">
                  <AccordionTrigger>How does ToonReels protect kids?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm text-muted-foreground">Filters violent/adult content, human moderators, parental PIN, and messaging locked by default.</p>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="pin-reset">
                  <AccordionTrigger>How do I reset my parent PIN?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm text-muted-foreground">Go to Settings → Parental Controls → "Forgot PIN?" You will be asked to verify your email.</p>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="icon">
                  <AccordionTrigger>App Icon / Avatar Info</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm text-muted-foreground">The official ToonReels app icon is: TR with a red-orange gradient background.</p>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </div>
      </div>
      <BottomNav />
    </div>
  );
};

export default Settings;
