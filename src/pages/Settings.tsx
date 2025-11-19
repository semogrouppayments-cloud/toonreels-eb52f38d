import { useNavigate } from "react-router-dom";
import { ArrowLeft, Moon, Sun } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import BottomNav from "@/components/BottomNav";
import { useTheme } from "@/contexts/ThemeContext";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Settings = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  
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

  useEffect(() => {
    fetchUserSettings();
  }, []);

  const fetchUserSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      
      const { data: profile } = await supabase.from('profiles').select('username, selected_avatar, age_range, profile_pin').eq('id', user.id).single();
      if (profile) {
        setUsername(profile.username || "");
        setSelectedAvatar(profile.selected_avatar || "🦊");
        setAgeRange(profile.age_range || "7-9");
        setProfilePin(profile.profile_pin || "");
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
      
      setLoading(false);
    } catch (error) {
      console.error('Error:', error);
      setLoading(false);
    }
  };

  const saveProfileSettings = async () => {
    if (!userId) return;
    try {
      await supabase.from('profiles').update({ username, selected_avatar: selectedAvatar, age_range: ageRange, profile_pin: profilePin }).eq('id', userId);
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
      await supabase.from('parental_controls').upsert({ user_id: userId, screen_time_limit: screenTimeLimit, school_hours_lock: schoolHoursLock, bedtime_lock: bedtimeLock, parental_pin: parentalPin });
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

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><p>Loading...</p></div>;

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-4xl mx-auto p-4">
        <div className="mb-6 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/profile')} className="rounded-full"><ArrowLeft className="h-6 w-6" /></Button>
          <h1 className="text-2xl font-black">🎛️ ToonReels Settings</h1>
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
