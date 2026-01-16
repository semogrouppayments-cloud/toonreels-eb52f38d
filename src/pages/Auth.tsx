import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Play, Sparkles, Eye, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import toonreelsLogo from '@/assets/toonreels-logo.png';


// Validation schemas
const emailSchema = z.string().email('Please enter a valid email address').max(255, 'Email is too long');
const passwordSchema = z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password is too long');
const usernameSchema = z.string()
  .min(3, 'Username must be at least 3 characters')
  .max(30, 'Username must be less than 30 characters')
  .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores');

const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  username: usernameSchema,
});

const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

const Auth = () => {
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const [splashFading, setSplashFading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [userType, setUserType] = useState<'viewer' | 'creative'>('viewer');
  const [errors, setErrors] = useState<{ email?: string; password?: string; username?: string }>({})

  // Splash screen timer - reduced to 1.5 seconds for faster startup
  useEffect(() => {
    const fadeTimer = setTimeout(() => {
      setSplashFading(true);
    }, 1200);

    const hideTimer = setTimeout(() => {
      setShowSplash(false);
    }, 1500);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  // Check for existing session on mount - remember login
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate('/feed', { replace: true });
      } else {
        setCheckingSession(false);
      }
    };
    
    checkSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && event === 'SIGNED_IN') {
        navigate('/feed', { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const validateForm = () => {
    setErrors({});
    
    try {
      if (isSignUp) {
        signUpSchema.parse({ email, password, username });
      } else {
        signInSchema.parse({ email, password });
      }
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: typeof errors = {};
        error.issues.forEach((err) => {
          const field = err.path[0] as keyof typeof errors;
          newErrors[field] = err.message;
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/feed`,
            data: {
              username,
              user_type: userType,
            },
          },
        });

        if (error) throw error;
        toast.success('Account created! Redirecting...');
        setTimeout(() => navigate('/feed'), 1000);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
        toast.success('Welcome back!');
        navigate('/feed');
      }
    } catch (error: any) {
      if (error.message?.includes('User already registered')) {
        toast.error('This email is already registered. Please sign in instead.');
      } else if (error.message?.includes('Invalid login credentials')) {
        toast.error('Invalid email or password. Please try again.');
      } else {
        toast.error(error.message || 'Authentication failed');
      }
    } finally {
      setLoading(false);
    }
  };

  // Show branded splash screen
  if (showSplash) {
    // Generate floating bubbles
    const bubbles = Array.from({ length: 15 }, (_, i) => ({
      id: i,
      size: Math.random() * 50 + 25,
      left: Math.random() * 100,
      delay: Math.random() * 1.5,
      duration: Math.random() * 3 + 4,
    }));

    // Spinning stars
    const stars = [
      { emoji: '⭐', top: '12%', left: '8%', size: 'text-3xl', delay: '0s', duration: '3s' },
      { emoji: '✨', top: '18%', right: '10%', size: 'text-4xl', delay: '0.5s', duration: '2.5s' },
      { emoji: '🌟', top: '25%', left: '15%', size: 'text-2xl', delay: '1s', duration: '4s' },
      { emoji: '⭐', bottom: '30%', right: '12%', size: 'text-3xl', delay: '0.3s', duration: '3.5s' },
      { emoji: '✨', bottom: '25%', left: '10%', size: 'text-2xl', delay: '0.8s', duration: '2.8s' },
      { emoji: '🌟', top: '35%', right: '20%', size: 'text-xl', delay: '1.2s', duration: '3.2s' },
    ];

    // Floating cartoon emojis
    const cartoonElements = [
      { emoji: '🎬', left: '5%', delay: 0, duration: 5 },
      { emoji: '🎨', left: '25%', delay: 1, duration: 6 },
      { emoji: '🎭', left: '45%', delay: 0.5, duration: 5.5 },
      { emoji: '🎪', left: '65%', delay: 1.5, duration: 4.5 },
      { emoji: '🎠', left: '85%', delay: 0.8, duration: 5.2 },
      { emoji: '🦄', left: '15%', delay: 2, duration: 6 },
      { emoji: '🌈', left: '75%', delay: 1.2, duration: 5.8 },
    ];

    return (
      <div 
        className={`flex min-h-screen flex-col items-center justify-center transition-opacity duration-500 overflow-hidden relative ${splashFading ? 'opacity-0' : 'opacity-100'}`}
        style={{
          background: 'linear-gradient(135deg, #FF6B35 0%, #FF4444 35%, #E91E63 70%, #FF6B6B 100%)'
        }}
      >
        {/* Animated background waves */}
        <div className="absolute inset-0 overflow-hidden">
          <div 
            className="absolute w-[200%] h-40 bg-white/10 rounded-full"
            style={{
              top: '20%',
              left: '-50%',
              animation: 'wave 8s ease-in-out infinite',
            }}
          />
          <div 
            className="absolute w-[200%] h-32 bg-white/5 rounded-full"
            style={{
              top: '60%',
              left: '-50%',
              animation: 'wave 10s ease-in-out infinite reverse',
            }}
          />
        </div>

        {/* Floating bubbles from bottom */}
        {bubbles.map((bubble) => (
          <div
            key={bubble.id}
            className="absolute rounded-full bg-white/25 backdrop-blur-sm shadow-lg"
            style={{
              width: bubble.size,
              height: bubble.size,
              left: `${bubble.left}%`,
              bottom: '-15%',
              animation: `floatUp ${bubble.duration}s ease-out ${bubble.delay}s infinite`,
            }}
          />
        ))}

        {/* Spinning stars */}
        {stars.map((star, i) => (
          <div
            key={i}
            className={`absolute ${star.size} drop-shadow-lg`}
            style={{
              top: star.top,
              left: star.left,
              right: star.right,
              bottom: star.bottom,
              animation: `spin ${star.duration} linear infinite, pulse 2s ease-in-out infinite`,
              animationDelay: star.delay,
            }}
          >
            {star.emoji}
          </div>
        ))}

        {/* Floating cartoon elements from bottom */}
        {cartoonElements.map((element, i) => (
          <div
            key={`cartoon-${i}`}
            className="absolute text-4xl"
            style={{
              left: element.left,
              bottom: '-15%',
              animation: `floatUp ${element.duration}s ease-out ${element.delay}s infinite, wiggle 2s ease-in-out infinite`,
            }}
          >
            {element.emoji}
          </div>
        ))}
        
        {/* Multiple glowing effects */}
        <div className="absolute w-72 h-72 bg-yellow-400/30 rounded-full blur-3xl animate-pulse" />
        <div className="absolute w-48 h-48 bg-orange-300/40 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '0.5s' }} />
        <div className="absolute w-32 h-32 bg-white/30 rounded-full blur-xl animate-ping" style={{ animationDuration: '2s' }} />
        
        {/* Logo with enhanced bounce animation */}
        <img 
          src={toonreelsLogo} 
          alt="ToonlyReels" 
          className="w-40 h-40 mb-8 drop-shadow-2xl relative z-10"
          style={{ 
            animation: 'bounceScale 1.5s ease-in-out infinite',
            filter: 'drop-shadow(0 0 30px rgba(255,255,255,0.5))'
          }}
        />
        
        {/* Bold title with playful styling */}
        <h1 
          className="text-5xl md:text-6xl font-black text-white mb-4 relative z-10 tracking-tight"
          style={{
            textShadow: '3px 3px 0 rgba(0,0,0,0.2), 0 0 30px rgba(255,255,255,0.3)',
            animation: 'fadeInUp 0.8s ease-out forwards',
          }}
        >
          ToonlyReels
        </h1>
        
        {/* Tagline with animated words */}
        <div className="flex gap-3 text-xl md:text-2xl font-bold text-white/95 relative z-10">
          <span 
            className="animate-in fade-in slide-in-from-bottom-4 duration-500"
            style={{ animationDelay: '0.3s', textShadow: '2px 2px 0 rgba(0,0,0,0.2)' }}
          >
            Watch.
          </span>
          <span 
            className="animate-in fade-in slide-in-from-bottom-4 duration-500"
            style={{ animationDelay: '0.5s', textShadow: '2px 2px 0 rgba(0,0,0,0.2)' }}
          >
            Create.
          </span>
          <span 
            className="animate-in fade-in slide-in-from-bottom-4 duration-500"
            style={{ animationDelay: '0.7s', textShadow: '2px 2px 0 rgba(0,0,0,0.2)' }}
          >
            Share.
          </span>
        </div>

        {/* Decorative confetti dots */}
        <div className="absolute top-[15%] left-[20%] w-3 h-3 bg-yellow-300 rounded-full animate-ping" style={{ animationDuration: '1.5s' }} />
        <div className="absolute top-[25%] right-[25%] w-2 h-2 bg-white rounded-full animate-ping" style={{ animationDuration: '2s', animationDelay: '0.3s' }} />
        <div className="absolute bottom-[35%] left-[18%] w-2 h-2 bg-orange-200 rounded-full animate-ping" style={{ animationDuration: '1.8s', animationDelay: '0.6s' }} />
        <div className="absolute bottom-[40%] right-[15%] w-3 h-3 bg-yellow-200 rounded-full animate-ping" style={{ animationDuration: '2.2s', animationDelay: '0.9s' }} />

        {/* Custom keyframes style tag */}
        <style>{`
          @keyframes bounceScale {
            0%, 100% { transform: scale(1) translateY(0); }
            25% { transform: scale(1.05) translateY(-10px); }
            50% { transform: scale(0.98) translateY(0); }
            75% { transform: scale(1.02) translateY(-5px); }
          }
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes wave {
            0%, 100% { transform: translateX(0) rotate(-2deg); }
            50% { transform: translateX(-25%) rotate(2deg); }
          }
          @keyframes wiggle {
            0%, 100% { transform: rotate(-5deg); }
            50% { transform: rotate(5deg); }
          }
        `}</style>
      </div>
    );
  }

  // Show loading while checking session
  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 relative">
      {/* Version indicator */}
      <div className="absolute bottom-4 left-4 text-xs text-muted-foreground/50 font-mono">
        v202601C
      </div>
      <Card className="w-full max-w-md shadow-elevated animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-500">
        <CardHeader className="text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent mx-auto">
            <Play className="h-8 w-8 text-primary-foreground fill-primary-foreground" />
          </div>
          <CardTitle className="text-3xl font-black">
            {isSignUp ? 'Join ToonlyReels!' : 'Welcome Back!'}
          </CardTitle>
          <CardDescription>
            {isSignUp ? 'Create your account to start watching' : 'Sign in to continue'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            {isSignUp && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      if (errors.username) setErrors(prev => ({ ...prev, username: undefined }));
                    }}
                    placeholder="Enter username"
                    className={errors.username ? 'border-destructive' : ''}
                  />
                  {errors.username && (
                    <p className="text-sm text-destructive">{errors.username}</p>
                  )}
                </div>
                
                <div className="space-y-3">
                  <Label>I want to...</Label>
                  <RadioGroup value={userType} onValueChange={(value) => setUserType(value as 'viewer' | 'creative')}>
                    <div className="flex items-center space-x-3 rounded-xl border-2 border-border p-4 hover:border-primary transition-colors">
                      <RadioGroupItem value="viewer" id="viewer" />
                      <Label htmlFor="viewer" className="flex items-center gap-2 cursor-pointer flex-1">
                        <Eye className="h-5 w-5 text-fun-blue" />
                        <div>
                          <div className="font-semibold">Watch Cartoons</div>
                          <div className="text-sm text-muted-foreground">Enjoy amazing animations</div>
                        </div>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-3 rounded-xl border-2 border-border p-4 hover:border-primary transition-colors">
                      <RadioGroupItem value="creative" id="creative" />
                      <Label htmlFor="creative" className="flex items-center gap-2 cursor-pointer flex-1">
                        <Sparkles className="h-5 w-5 text-fun-yellow" />
                        <div>
                          <div className="font-semibold">Upload My Animations</div>
                          <div className="text-sm text-muted-foreground">Share your creative work</div>
                        </div>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors(prev => ({ ...prev, email: undefined }));
                }}
                placeholder="Enter your email"
                className={errors.email ? 'border-destructive' : ''}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors(prev => ({ ...prev, password: undefined }));
                }}
                placeholder="Enter your password"
                className={errors.password ? 'border-destructive' : ''}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password}</p>
              )}
              {isSignUp && !errors.password && (
                <p className="text-xs text-muted-foreground">Must be at least 8 characters</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? 'Loading...' : isSignUp ? 'Create Account' : 'Sign In'}
            </Button>
          </form>

          <div className="mt-4 text-center space-y-2">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setErrors({});
              }}
              className="text-sm text-primary hover:underline font-semibold block w-full"
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
            <a
              href="/terms-of-service"
              className="text-xs text-muted-foreground hover:text-primary hover:underline block"
            >
              Terms of Use
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;