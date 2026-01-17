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
    // Simple floating bubbles from bottom
    const bubbles = Array.from({ length: 8 }, (_, i) => ({
      id: i,
      size: Math.random() * 30 + 15,
      left: Math.random() * 100,
      delay: Math.random() * 2,
      duration: Math.random() * 4 + 5,
    }));

    // Simple stars
    const stars = [
      { emoji: '⭐', top: '15%', left: '12%', delay: '0s' },
      { emoji: '✨', top: '20%', right: '15%', delay: '0.5s' },
      { emoji: '🌟', bottom: '25%', left: '10%', delay: '1s' },
      { emoji: '⭐', bottom: '20%', right: '12%', delay: '0.3s' },
    ];

    return (
      <div 
        className={`flex min-h-screen flex-col items-center justify-center transition-opacity duration-500 overflow-hidden relative ${splashFading ? 'opacity-0' : 'opacity-100'}`}
        style={{
          background: 'linear-gradient(135deg, #FF8C00 0%, #FF6B35 40%, #FF4444 100%)'
        }}
      >
        {/* Floating bubbles from bottom */}
        {bubbles.map((bubble) => (
          <div
            key={bubble.id}
            className="absolute rounded-full bg-white/20"
            style={{
              width: bubble.size,
              height: bubble.size,
              left: `${bubble.left}%`,
              bottom: '-10%',
              animation: `floatUp ${bubble.duration}s ease-out ${bubble.delay}s infinite`,
            }}
          />
        ))}

        {/* Simple twinkling stars */}
        {stars.map((star, i) => (
          <div
            key={i}
            className="absolute text-2xl opacity-80"
            style={{
              top: star.top,
              left: star.left,
              right: star.right,
              bottom: star.bottom,
              animation: `twinkle 2s ease-in-out infinite`,
              animationDelay: star.delay,
            }}
          >
            {star.emoji}
          </div>
        ))}
        
        {/* Subtle glow behind logo */}
        <div className="absolute w-48 h-48 bg-white/20 rounded-full blur-3xl" />
        
        {/* Bouncing Logo */}
        <img 
          src={toonreelsLogo} 
          alt="ToonlyReels" 
          className="w-32 h-32 mb-6 drop-shadow-2xl relative z-10"
          style={{ 
            animation: 'bounce 1.5s ease-in-out infinite',
            filter: 'drop-shadow(0 0 20px rgba(255,255,255,0.4))'
          }}
        />
        
        {/* App Name */}
        <h1 
          className="text-4xl md:text-5xl font-black text-white mb-3 relative z-10"
          style={{
            textShadow: '2px 2px 0 rgba(0,0,0,0.15)',
          }}
        >
          ToonlyReels
        </h1>
        
        {/* Tagline */}
        <p 
          className="text-lg md:text-xl font-semibold text-white/90 relative z-10"
          style={{ textShadow: '1px 1px 0 rgba(0,0,0,0.1)' }}
        >
          Watch. Create. Share.
        </p>

        {/* Subtle loading indicator */}
        <div className="mt-8 flex items-center gap-2 relative z-10">
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-white/70"
                style={{
                  animation: 'loadingDot 1.4s ease-in-out infinite',
                  animationDelay: `${i * 0.2}s`,
                }}
              />
            ))}
          </div>
        </div>

        {/* Custom keyframes */}
        <style>{`
          @keyframes floatUp {
            0% { transform: translateY(0) scale(1); opacity: 0.6; }
            50% { opacity: 0.8; }
            100% { transform: translateY(-100vh) scale(0.5); opacity: 0; }
          }
          @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-15px); }
          }
          @keyframes twinkle {
            0%, 100% { opacity: 0.6; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.2); }
          }
          @keyframes loadingDot {
            0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
            40% { transform: scale(1); opacity: 1; }
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