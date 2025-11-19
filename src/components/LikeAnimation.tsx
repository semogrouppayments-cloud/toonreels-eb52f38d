import { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';

interface LikeAnimationProps {
  x: number;
  y: number;
  onComplete: () => void;
}

const LikeAnimation = ({ x, y, onComplete }: LikeAnimationProps) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onComplete();
    }, 1000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  if (!visible) return null;

  return (
    <div
      className="fixed pointer-events-none z-50"
      style={{
        left: x - 40,
        top: y - 40,
        animation: 'float-up 1s ease-out forwards',
      }}
    >
      <Heart
        className="w-20 h-20 fill-red-500 text-red-500"
        style={{
          filter: 'drop-shadow(0 0 10px rgba(239, 68, 68, 0.8))',
          animation: 'scale-pulse 1s ease-out forwards',
        }}
      />
    </div>
  );
};

export default LikeAnimation;
