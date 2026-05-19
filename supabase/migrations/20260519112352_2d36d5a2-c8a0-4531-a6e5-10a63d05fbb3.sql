ALTER TABLE public.videos
ADD COLUMN IF NOT EXISTS video_variants JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_videos_video_variants
ON public.videos USING GIN (video_variants);