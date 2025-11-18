import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play } from 'lucide-react';

const Splash = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/auth');
    }, 2500);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary via-accent to-fun-yellow overflow-hidden">
      <div className="text-center animate-in fade-in zoom-in duration-700">
        <div className="mb-6 inline-flex h-32 w-32 items-center justify-center rounded-3xl bg-background/20 backdrop-blur-lg shadow-elevated">
          <Play className="h-16 w-16 text-background fill-background" />
        </div>
        <h1 className="text-5xl font-black text-background mb-2 drop-shadow-lg">
          ToonReels
        </h1>
        <p className="text-xl text-background/90 font-semibold">
          Animated Fun for Kids!
        </p>
      </div>
    </div>
  );
};

export default Splash;
