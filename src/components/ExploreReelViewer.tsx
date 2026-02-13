import { useState, useRef, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import VideoPlayer from '@/components/VideoPlayer';
import CommentsSheet from '@/components/CommentsSheet';
import { supabase } from '@/integrations/supabase/client';

interface Video {
  id: string;
  title: string;
  description: string;
  thumbnail_url: string | null;
  video_url: string;
  likes_count: number;
  views_count: number;
  tags: string[] | null;
  creator_id: string;
  subtitles?: any;
  profiles: {
    username: string;
    avatar_url: string;
    is_verified: boolean;
  };
}

interface ExploreReelViewerProps {
  videos: Video[];
  startIndex: number;
  sectionTitle: string;
  onClose: () => void;
}

const ExploreReelViewer = ({ videos, startIndex, sectionTitle, onClose }: ExploreReelViewerProps) => {
  const [activeIndex, setActiveIndex] = useState(startIndex);
  const [commentsVideoId, setCommentsVideoId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const containerRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
  }, []);

  const handleScroll = useCallback(() => {
    if (!containerRef.current || isScrollingRef.current) return;
    const container = containerRef.current;
    const scrollTop = container.scrollTop;
    const viewportHeight = container.clientHeight;
    const newIndex = Math.round(scrollTop / viewportHeight);
    if (newIndex !== activeIndex && newIndex >= 0 && newIndex < videos.length) {
      setActiveIndex(newIndex);
    }
  }, [activeIndex, videos.length]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: startIndex * containerRef.current.clientHeight });
    }
  }, []);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div className="fixed inset-0 z-[60] bg-black">
      <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/60 to-transparent">
        <span className="text-white font-semibold text-sm truncate max-w-[70%]">{sectionTitle}</span>
        <button
          onClick={onClose}
          className="bg-black/40 rounded-full p-2 text-white hover:bg-black/60 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div
        ref={containerRef}
        className="h-full w-full overflow-y-scroll snap-y snap-mandatory"
        style={{ scrollSnapType: 'y mandatory' }}
      >
        {videos.map((video, index) => {
          const shouldRender = Math.abs(index - activeIndex) <= 1;
          return (
            <div
              key={video.id}
              className="h-screen w-full snap-start snap-always"
              style={{ scrollSnapAlign: 'start' }}
            >
              {shouldRender ? (
                <VideoPlayer
                  video={video}
                  isActive={index === activeIndex}
                  onCommentsClick={() => setCommentsVideoId(video.id)}
                  currentUserId={currentUserId}
                  isPremium={false}
                />
              ) : (
                <div className="h-full w-full bg-black" />
              )}
            </div>
          );
        })}
      </div>

      {commentsVideoId && (
        <CommentsSheet
          videoId={commentsVideoId}
          isOpen={!!commentsVideoId}
          onClose={() => setCommentsVideoId(null)}
          currentUserId={currentUserId}
        />
      )}
    </div>
  );
};

export default ExploreReelViewer;
