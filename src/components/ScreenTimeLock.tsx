import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Clock, Lock, Moon, BookOpen } from 'lucide-react';
import { toast } from 'sonner';

interface ScreenTimeLockProps {
  userId: string;
  onUnlock: () => void;
}

type LockReason = 'screen_time' | 'bedtime' | 'school_hours' | null;

const ScreenTimeLock = ({ userId, onUnlock }: ScreenTimeLockProps) => {
  const [lockReason, setLockReason] = useState<LockReason>(null);
  const [pin, setPin] = useState('');
  const [showPinInput, setShowPinInput] = useState(false);
  const [timeUsed, setTimeUsed] = useState(0);
  const [timeLimit, setTimeLimit] = useState(60);

  useEffect(() => {
    checkLockStatus();
    const interval = setInterval(checkLockStatus, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [userId]);

  const checkLockStatus = async () => {
    if (!userId) return;

    try {
      // Get parental controls
      const { data: controls } = await supabase
        .from('parental_controls')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (!controls) {
        setLockReason(null);
        return;
      }

      const now = new Date();
      const currentTime = now.getHours() * 60 + now.getMinutes();

      // Check bedtime lock
      if (controls.bedtime_lock && controls.bedtime_start && controls.bedtime_end) {
        const [bedStartH, bedStartM] = controls.bedtime_start.split(':').map(Number);
        const [bedEndH, bedEndM] = controls.bedtime_end.split(':').map(Number);
        const bedStart = bedStartH * 60 + bedStartM;
        const bedEnd = bedEndH * 60 + bedEndM;

        // Handle overnight bedtime (e.g., 21:00 to 07:00)
        if (bedStart > bedEnd) {
          if (currentTime >= bedStart || currentTime < bedEnd) {
            setLockReason('bedtime');
            return;
          }
        } else if (currentTime >= bedStart && currentTime < bedEnd) {
          setLockReason('bedtime');
          return;
        }
      }

      // Check school hours lock
      if (controls.school_hours_lock && controls.school_start_time && controls.school_end_time) {
        const [schoolStartH, schoolStartM] = controls.school_start_time.split(':').map(Number);
        const [schoolEndH, schoolEndM] = controls.school_end_time.split(':').map(Number);
        const schoolStart = schoolStartH * 60 + schoolStartM;
        const schoolEnd = schoolEndH * 60 + schoolEndM;

        // Only check on weekdays
        const dayOfWeek = now.getDay();
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
          if (currentTime >= schoolStart && currentTime < schoolEnd) {
            setLockReason('school_hours');
            return;
          }
        }
      }

      // Check screen time limit
      if (controls.screen_time_limit) {
        setTimeLimit(controls.screen_time_limit);
        
        // Get today's usage from local storage
        const today = now.toDateString();
        const usageKey = `screen_time_${userId}_${today}`;
        const storedUsage = parseInt(localStorage.getItem(usageKey) || '0', 10);
        
        setTimeUsed(storedUsage);
        
        if (storedUsage >= controls.screen_time_limit) {
          setLockReason('screen_time');
          return;
        }
      }

      setLockReason(null);
    } catch (error) {
      console.error('Error checking lock status:', error);
    }
  };

  const handleParentUnlock = async () => {
    try {
      const { data: isValid } = await supabase.rpc('verify_parental_pin', {
        _user_id: userId,
        _raw_pin: pin,
      });

      if (isValid) {
        // Grant 15 minutes bonus time
        const today = new Date().toDateString();
        const usageKey = `screen_time_${userId}_${today}`;
        const currentUsage = parseInt(localStorage.getItem(usageKey) || '0', 10);
        localStorage.setItem(usageKey, Math.max(0, currentUsage - 15).toString());
        
        setLockReason(null);
        onUnlock();
        toast.success('Unlocked! 15 minutes added.');
      } else {
        toast.error('Invalid PIN');
      }
    } catch (error) {
      toast.error('Failed to verify PIN');
    }
    setPin('');
    setShowPinInput(false);
  };

  if (!lockReason) return null;

  const getLockContent = () => {
    switch (lockReason) {
      case 'screen_time':
        return {
          icon: <Clock className="h-16 w-16 text-fun-coral" />,
          title: "Time's Up!",
          message: `You've used your ${timeLimit} minutes of screen time today.`,
          subMessage: 'Come back tomorrow for more fun!',
          color: 'from-fun-coral/20 to-fun-coral/5',
        };
      case 'bedtime':
        return {
          icon: <Moon className="h-16 w-16 text-fun-blue" />,
          title: "It's Bedtime! 🌙",
          message: "Time to rest and recharge.",
          subMessage: 'Sweet dreams! See you tomorrow.',
          color: 'from-fun-blue/20 to-fun-blue/5',
        };
      case 'school_hours':
        return {
          icon: <BookOpen className="h-16 w-16 text-fun-green" />,
          title: 'School Time! 📚',
          message: "It's time for learning.",
          subMessage: 'Come back after school!',
          color: 'from-fun-green/20 to-fun-green/5',
        };
      default:
        return {
          icon: <Lock className="h-16 w-16 text-muted-foreground" />,
          title: 'App Locked',
          message: 'Access is currently restricted.',
          subMessage: 'Ask a parent to unlock.',
          color: 'from-muted/20 to-muted/5',
        };
    }
  };

  const content = getLockContent();

  return (
    <div className={`fixed inset-0 z-[100] bg-gradient-to-b ${content.color} backdrop-blur-xl flex flex-col items-center justify-center p-6`}>
      <div className="text-center space-y-6 max-w-sm">
        <div className="animate-bounce">
          {content.icon}
        </div>
        
        <div className="space-y-2">
          <h1 className="text-3xl font-black text-foreground">{content.title}</h1>
          <p className="text-lg text-muted-foreground">{content.message}</p>
          <p className="text-sm text-muted-foreground/70">{content.subMessage}</p>
        </div>

        {lockReason === 'screen_time' && (
          <div className="bg-card rounded-xl p-4 space-y-2">
            <p className="text-sm text-muted-foreground">Today's Usage</p>
            <div className="flex items-center justify-center gap-2">
              <span className="text-2xl font-black">{timeUsed}</span>
              <span className="text-muted-foreground">/ {timeLimit} min</span>
            </div>
          </div>
        )}

        {!showPinInput ? (
          <Button
            variant="outline"
            onClick={() => setShowPinInput(true)}
            className="mt-8"
          >
            <Lock className="h-4 w-4 mr-2" />
            Parent Unlock
          </Button>
        ) : (
          <div className="space-y-3 mt-8">
            <Input
              type="password"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="Enter parent PIN"
              className="text-center text-xl tracking-widest"
            />
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setShowPinInput(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleParentUnlock} disabled={pin.length < 4} className="flex-1">
                Unlock
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScreenTimeLock;
