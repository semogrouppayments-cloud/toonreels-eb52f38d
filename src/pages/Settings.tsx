import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ArrowLeft, Moon, Sun } from 'lucide-react';
import BottomNav from '@/components/BottomNav';

const Settings = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-2xl mx-auto p-4">
        <div className="mb-6 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/profile')}
            className="rounded-full"
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <h1 className="text-2xl font-black">🎛️ TuneReels Settings</h1>
        </div>

        <div className="space-y-4">
          {/* Account & Profile */}
          <Card>
            <CardHeader>
              <CardTitle>Account & Profile</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="profile">
                  <AccordionTrigger>Profile Name & Avatar</AccordionTrigger>
                  <AccordionContent>
                    Choose a fun avatar and safe profile name. No personal photos allowed for safety.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="age">
                  <AccordionTrigger>Age Range</AccordionTrigger>
                  <AccordionContent>
                    Select your age range so the app can auto-filter cartoon content suitable for you.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="theme">
                  <AccordionTrigger>Theme</AccordionTrigger>
                  <AccordionContent>
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-3">
                        {theme === 'dark' ? (
                          <Moon className="h-5 w-5 text-primary" />
                        ) : (
                          <Sun className="h-5 w-5 text-primary" />
                        )}
                        <div>
                          <Label htmlFor="theme-toggle" className="text-base font-semibold">
                            {theme === 'dark' ? 'Dark' : 'Bright'} Mode
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Switch between light and dark theme
                          </p>
                        </div>
                      </div>
                      <Switch
                        id="theme-toggle"
                        checked={theme === 'dark'}
                        onCheckedChange={toggleTheme}
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="pin">
                  <AccordionTrigger>Profile PIN</AccordionTrigger>
                  <AccordionContent>
                    Lock your profile with a 4-digit PIN to keep settings protected.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          {/* Safety & Content Controls */}
          <Card>
            <CardHeader>
              <CardTitle>Safety & Content Controls</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="cartoon-mode">
                  <AccordionTrigger>Cartoon-Only Mode</AccordionTrigger>
                  <AccordionContent>
                    This mode is always ON and prevents any adult or real-life influencer content from appearing.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="categories">
                  <AccordionTrigger>Content Categories</AccordionTrigger>
                  <AccordionContent>
                    Choose what kind of cartoon reels you want: comedy, adventure, learning, music, and more.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="comments">
                  <AccordionTrigger>Comments Visibility</AccordionTrigger>
                  <AccordionContent>
                    Toggle text comments off and only allow emoji reactions for a safer experience.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="interactions">
                  <AccordionTrigger>Interaction Limits</AccordionTrigger>
                  <AccordionContent>
                    Messaging is disabled by default. Your profile is hidden from strangers.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          {/* Parental Controls */}
          <Card>
            <CardHeader>
              <CardTitle>Parental Controls</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="screen-time">
                  <AccordionTrigger>Screen Time</AccordionTrigger>
                  <AccordionContent>
                    Parents can limit daily watch time or set app bedtime hours.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="history">
                  <AccordionTrigger>History</AccordionTrigger>
                  <AccordionContent>
                    View recently watched reels and categories.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="school-hours">
                  <AccordionTrigger>School Hours Lock</AccordionTrigger>
                  <AccordionContent>
                    Block the app during certain hours to prevent distractions.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          {/* Playback Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Playback Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="autoplay">
                  <AccordionTrigger>Autoplay</AccordionTrigger>
                  <AccordionContent>
                    Turn autoplay on or off depending on your preference.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="quality">
                  <AccordionTrigger>Video Quality</AccordionTrigger>
                  <AccordionContent>
                    Choose Low, Medium, High, or Auto (Wi-Fi Only).
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="subtitles">
                  <AccordionTrigger>Subtitles</AccordionTrigger>
                  <AccordionContent>
                    Enable subtitles and choose a font size.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          {/* App Controls */}
          <Card>
            <CardHeader>
              <CardTitle>App Controls</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="cache">
                  <AccordionTrigger>Clear Cache</AccordionTrigger>
                  <AccordionContent>
                    Free up storage by clearing temporary files.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="reset">
                  <AccordionTrigger>Reset Child Mode</AccordionTrigger>
                  <AccordionContent>
                    Reset to default safety settings.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          {/* FAQ & Help */}
          <Card>
            <CardHeader>
              <CardTitle>❓ FAQ & Help</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3 text-sm">
                <div className="rounded-lg border-l-4 border-primary bg-muted/50 p-3">
                  <strong className="block mb-1">Q: Why can I only see cartoon reels?</strong>
                  <p className="text-muted-foreground">A: TuneReels is designed to be kid-safe, so all adult, scary, violent, and real-life influencer content is blocked automatically.</p>
                </div>
                <div className="rounded-lg border-l-4 border-primary bg-muted/50 p-3">
                  <strong className="block mb-1">Q: Why can't I send messages?</strong>
                  <p className="text-muted-foreground">A: To keep users safe, messaging is disabled and profiles are not publicly visible.</p>
                </div>
                <div className="rounded-lg border-l-4 border-primary bg-muted/50 p-3">
                  <strong className="block mb-1">Q: How do parents set time limits?</strong>
                  <p className="text-muted-foreground">A: A parent can open Settings → Parental Controls and create a PIN to adjust limits.</p>
                </div>
                <div className="rounded-lg border-l-4 border-primary bg-muted/50 p-3">
                  <strong className="block mb-1">Q: Why are some reels blocked?</strong>
                  <p className="text-muted-foreground">A: Certain content categories may be restricted based on age settings or parental controls.</p>
                </div>
                <div className="rounded-lg border-l-4 border-primary bg-muted/50 p-3">
                  <strong className="block mb-1">Q: The app is locked. What do I do?</strong>
                  <p className="text-muted-foreground">A: It may be School Hours Lock or Bedtime Mode. Ask your parent or guardian for help unlocking it.</p>
                </div>
                <div className="rounded-lg border-l-4 border-primary bg-muted/50 p-3">
                  <strong className="block mb-1">Q: How do I report a reel?</strong>
                  <p className="text-muted-foreground">A: Tap the three dots on any reel → Report. A moderator will review it.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default Settings;
