import { useState, useRef, useEffect } from 'react';
import { Play, Eye, Heart } from 'lucide-react';

interface VideoPreviewCardProps {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  videoUrl: string;
  viewsCount: number;
  likesCount: number;
  onClick: () => void;
  formatCount: (count: number) => string;
}

const VideoPreviewCard = ({
  id,
  title,
  thumbnailUrl,
  videoUrl,
  viewsCount,
  likesCount,
  onClick,
  formatCount
}: VideoPreviewCardProps) => {
  const [isHovering, setIsHovering] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Intersection Observer for mobile auto-preview
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsVisible(entry.isIntersecting && entry.intersectionRatio > 0.5);
        });
      },
      { threshold: 0.5 }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Handle video playback based on hover (desktop) or visibility (mobile)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const shouldPlay = isHovering || isVisible;

    if (shouldPlay && videoLoaded) {
      video.currentTime = 0;
      video.play().catch(() => {});
    } else {
      video.pause();
      video.currentTime = 0;
    }
  }, [isHovering, isVisible, videoLoaded]);

  const handleMouseEnter = () => {
    // Small delay to prevent accidental triggers
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovering(true);
    }, 200);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    setIsHovering(false);
  };

  const handleVideoLoad = () => {
    setVideoLoaded(true);
  };

  const showVideo = isHovering || isVisible;

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="relative aspect-[9/16] bg-muted rounded-xl overflow-hidden cursor-pointer group"
    >
      {/* Thumbnail */}
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt={title}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            showVideo && videoLoaded ? 'opacity-0' : 'opacity-100'
          }`}
        />
      ) : (
        <div className={`w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center transition-opacity duration-300 ${
          showVideo && videoLoaded ? 'opacity-0' : 'opacity-100'
        }`}>
          <Play className="h-8 w-8 text-primary/50" />
        </div>
      )}

      {/* Video Preview - Always mounted for preloading but hidden when not active */}
      <video
        ref={videoRef}
        src={videoUrl}
        muted
        loop
        playsInline
        preload="metadata"
        onCanPlay={handleVideoLoad}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
          showVideo && videoLoaded ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Play button overlay - only show when not previewing */}
      {!showVideo && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-black/30 rounded-full p-2">
            <Play className="h-5 w-5 text-white fill-white" />
          </div>
        </div>
      )}

      {/* Stats overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
        <div className="flex items-center justify-between text-white text-xs">
          <div className="flex items-center gap-1">
            <Eye className="h-3 w-3" />
            <span>{formatCount(viewsCount)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Heart className="h-3 w-3" />
            <span>{formatCount(likesCount)}</span>
          </div>
        </div>
      </div>

      {/* Hover indicator */}
      {showVideo && videoLoaded && (
        <div className="absolute top-2 right-2">
          <div className="bg-red-500 rounded-full w-2 h-2 animate-pulse" />
        </div>
      )}
    </div>
  );
};

export default VideoPreviewCard;
