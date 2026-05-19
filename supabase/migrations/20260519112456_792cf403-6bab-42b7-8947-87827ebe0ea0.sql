CREATE OR REPLACE FUNCTION public.update_video_variants(
  _video_id uuid,
  _variants jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  video_owner uuid;
BEGIN
  SELECT creator_id INTO video_owner
  FROM public.videos
  WHERE id = _video_id;

  IF video_owner IS NULL THEN
    RAISE EXCEPTION 'Video not found';
  END IF;

  IF auth.uid() IS NULL OR (auth.uid() != video_owner AND NOT public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.videos
  SET video_variants = COALESCE(_variants, '{}'::jsonb)
  WHERE id = _video_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_video_variants(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_video_variants(uuid, jsonb) TO authenticated;