import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.83.0";

// Allowed origins for CORS - restrict to specific domains
const ALLOWED_ORIGINS = [
  'https://lovable.dev',
  'https://www.lovable.dev',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:8080',
];

// Get CORS headers based on request origin
function getCorsHeaders(origin: string | null): Record<string, string> {
  // Check if origin is in allowed list or matches lovable.app subdomain
  const isAllowed = origin && (
    ALLOWED_ORIGINS.includes(origin) ||
    /^https:\/\/[a-z0-9-]+\.lovable\.app$/.test(origin) ||
    /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/.test(origin)
  );
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true',
  };
}

// Sanitize username to prevent command injection in FFmpeg
function sanitizeUsername(username: string): string {
  // Allow only alphanumeric characters, underscores, and hyphens
  // Remove or escape characters that could break FFmpeg filter syntax
  return username
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .substring(0, 30);
}

// Helper function to add watermark using FFmpeg
async function addWatermarkToVideo(
  videoBuffer: Uint8Array,
  username: string,
  videoId: string
): Promise<Uint8Array> {
  // Sanitize username to prevent command injection
  const safeUsername = sanitizeUsername(username);
  // Create temporary files
  const inputPath = `/tmp/input_${videoId}.mp4`;
  const outputPath = `/tmp/output_${videoId}.mp4`;
  
  try {
    // Write input video to temp file
    await Deno.writeFile(inputPath, videoBuffer);
    
    // FFmpeg command to add watermark text and outro
    // Add "ToonReels" watermark in bottom-left corner
    // Add outro with sanitized username in the last 2 seconds
    const ffmpegCommand = new Deno.Command("ffmpeg", {
      args: [
        "-i", inputPath,
        "-vf", 
        `drawtext=text='ToonReels':fontsize=24:fontcolor=white@0.7:x=10:y=h-th-10:shadowcolor=black@0.5:shadowx=2:shadowy=2,` +
        `drawtext=text='@${safeUsername}':fontsize=20:fontcolor=white:x=(w-text_w)/2:y=h-th-20:enable='gte(t,duration-2)':shadowcolor=black@0.8:shadowx=2:shadowy=2`,
        "-codec:a", "copy",
        "-y",
        outputPath
      ],
      stdout: "piped",
      stderr: "piped",
    });
    
    const process = ffmpegCommand.spawn();
    const { code, stderr } = await process.output();
    
    if (code !== 0) {
      const errorString = new TextDecoder().decode(stderr);
      console.error("FFmpeg error:", errorString);
      throw new Error("Video processing failed");
    }
    
    // Read processed video
    const processedVideo = await Deno.readFile(outputPath);
    
    // Clean up temp files
    try {
      await Deno.remove(inputPath);
      await Deno.remove(outputPath);
    } catch (cleanupError) {
      console.warn("Cleanup warning:", cleanupError);
    }
    
    return processedVideo;
  } catch (error) {
    // Clean up on error
    try {
      await Deno.remove(inputPath).catch(() => {});
      await Deno.remove(outputPath).catch(() => {});
    } catch {}
    throw error;
  }
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Authentication failed:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get video_id from request
    const { video_id } = await req.json();
    if (!video_id) {
      return new Response(
        JSON.stringify({ error: 'video_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get video details with creator info
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select(`
        video_url, 
        title, 
        creator_id,
        profiles!videos_creator_id_fkey(username)
      `)
      .eq('id', video_id)
      .single();

    if (videoError || !video) {
      console.error('Video fetch failed:', videoError);
      return new Response(
        JSON.stringify({ error: 'Video not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const creatorUsername = (video.profiles as any)?.username || 'ToonReels';

    // Extract the file path from the video_url
    const videoUrlPath = new URL(video.video_url).pathname;
    const filePath = videoUrlPath.split('/').slice(-2).join('/');

    // Download the original video
    const { data: videoBlob, error: downloadError } = await supabase
      .storage
      .from('videos')
      .download(filePath);

    if (downloadError || !videoBlob) {
      console.error('Failed to download video:', downloadError);
      return new Response(
        JSON.stringify({ error: 'Failed to download video for processing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Convert blob to buffer
    const videoBuffer = new Uint8Array(await videoBlob.arrayBuffer());

    // Add watermark to video
    console.log(`Processing video ${video_id} with watermark for user @${creatorUsername}`);
    const watermarkedVideo = await addWatermarkToVideo(videoBuffer, creatorUsername, video_id);

    // Upload watermarked video to temporary storage
    const tempFileName = `downloads/${user.id}/${video_id}_watermarked_${Date.now()}.mp4`;
    const { error: uploadError } = await supabase
      .storage
      .from('videos')
      .upload(tempFileName, watermarkedVideo, {
        contentType: 'video/mp4',
        upsert: true
      });

    if (uploadError) {
      console.error('Failed to upload watermarked video:', uploadError);
      return new Response(
        JSON.stringify({ error: 'Failed to process watermarked video' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate signed URL for watermarked video
    const { data: signedUrlData, error: signedUrlError } = await supabase
      .storage
      .from('videos')
      .createSignedUrl(tempFileName, 3600);

    if (signedUrlError || !signedUrlData) {
      console.error('Failed to generate signed URL:', signedUrlError);
      return new Response(
        JSON.stringify({ error: 'Failed to generate download URL' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log the download
    await supabase.from('video_downloads').insert({
      video_id,
      user_id: user.id
    });

    console.log(`Watermarked video ready for download. User: ${user.id}, Video: ${video_id}, Creator: @${creatorUsername}`);

    return new Response(
      JSON.stringify({ 
        download_url: signedUrlData.signedUrl,
        title: video.title,
        watermarked: true
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in download-video function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
