import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload as UploadIcon, ArrowLeft } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import { toast } from 'sonner';

const Upload = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);

  const generateThumbnail = (videoFile: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      
      video.onloadedmetadata = () => {
        video.currentTime = 0.5; // Get frame at 0.5 seconds
      };
      
      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to generate thumbnail'));
            }
          }, 'image/jpeg', 0.8);
        } else {
          reject(new Error('Failed to get canvas context'));
        }
      };
      
      video.onerror = () => reject(new Error('Failed to load video'));
      video.src = URL.createObjectURL(videoFile);
    });
  };

  const validateVideoAspectRatio = (videoFile: File): Promise<boolean> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      
      video.onloadedmetadata = () => {
        const aspectRatio = video.videoWidth / video.videoHeight;
        const target = 9 / 16;
        const tolerance = 0.05; // 5% tolerance
        
        URL.revokeObjectURL(video.src);
        resolve(Math.abs(aspectRatio - target) <= tolerance);
      };
      
      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        resolve(false);
      };
      
      video.src = URL.createObjectURL(videoFile);
    });
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoFile) {
      toast.error('Please select a video file');
      return;
    }

    // Validate file format
    const allowedFormats = ['mp4', 'webm', 'mov'];
    const fileExt = videoFile.name.split('.').pop()?.toLowerCase();
    if (!fileExt || !allowedFormats.includes(fileExt)) {
      toast.error('Invalid video format. Only MP4, WebM, and MOV are supported.');
      return;
    }

    // Check file size (max 500MB)
    const maxSize = 500 * 1024 * 1024; // 500MB in bytes
    if (videoFile.size > maxSize) {
      toast.error('Video file is too large. Maximum size is 500MB');
      return;
    }

    // Validate aspect ratio (9:16)
    toast.info('Validating video...');
    const isValidRatio = await validateVideoAspectRatio(videoFile);
    if (!isValidRatio) {
      toast.error('Video must be in 9:16 aspect ratio (vertical format)');
      return;
    }

    setLoading(true);
    setUploadProgress(0);

    let progressInterval: NodeJS.Timeout | null = null;

    try {
      // Simulate progress based on estimated upload time
      const estimatedTimeMs = Math.min((videoFile.size / 1024 / 1024) * 1000, 60000); // ~1 second per MB, max 60s
      progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) return prev; // Stop at 90% until actual upload completes
          return prev + 5;
        });
      }, estimatedTimeMs / 18); // Reach 90% gradually

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Upload video to storage
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('videos')
        .upload(fileName, videoFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (progressInterval) clearInterval(progressInterval);
      setUploadProgress(95);

      if (uploadError) {
        console.error('Upload error details:', uploadError);
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('videos')
        .getPublicUrl(fileName);

      // Note: Since videos bucket is now private, we'll store the path
      // and generate signed URLs on-demand for viewing

      // Upload thumbnail if provided, otherwise generate from video
      let thumbnailUrl = '';
      if (thumbnailFile) {
        const thumbExt = thumbnailFile.name.split('.').pop();
        const thumbName = `${user.id}/thumb_${Date.now()}.${thumbExt}`;
        
        const { error: thumbError } = await supabase.storage
          .from('videos')
          .upload(thumbName, thumbnailFile);

        if (!thumbError) {
          const { data: { publicUrl: thumbUrl } } = supabase.storage
            .from('videos')
            .getPublicUrl(thumbName);
          thumbnailUrl = thumbUrl;
        }
      } else {
        // Auto-generate thumbnail from video
        try {
          const thumbnailBlob = await generateThumbnail(videoFile);
          const thumbName = `${user.id}/thumb_${Date.now()}.jpg`;
          
          const { error: thumbError } = await supabase.storage
            .from('videos')
            .upload(thumbName, thumbnailBlob);

          if (!thumbError) {
            const { data: { publicUrl: thumbUrl } } = supabase.storage
              .from('videos')
              .getPublicUrl(thumbName);
            thumbnailUrl = thumbUrl;
          }
        } catch (thumbError) {
          console.error('Thumbnail generation failed:', thumbError);
          // Continue without thumbnail
        }
      }

      // Store the URL path - signed URLs will be generated on-demand for viewing
      const { data: { publicUrl: videoUrl } } = supabase.storage
        .from('videos')
        .getPublicUrl(fileName);

      // Create video record
      const { error: insertError } = await supabase
        .from('videos')
        .insert({
          creator_id: user.id,
          title,
          description,
          video_url: videoUrl,
          thumbnail_url: thumbnailUrl,
        });

      if (insertError) throw insertError;

      setUploadProgress(100);
      toast.success('Video uploaded successfully!');
      setTimeout(() => navigate('/feed'), 500);
    } catch (error: any) {
      if (progressInterval) clearInterval(progressInterval);
      console.error('Upload error:', error);
      
      let errorMessage = 'Upload failed';
      if (error.message?.includes('Failed to fetch')) {
        errorMessage = 'Network error. Check your connection and try again.';
      } else if (error.message?.includes('payload')) {
        errorMessage = 'File too large. Maximum size is 500MB.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-2xl mx-auto p-4">
        <div className="mb-6 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/feed')}
            className="rounded-full"
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <h1 className="text-2xl font-black">Upload Animation</h1>
        </div>

        <Card className="shadow-elevated">
          <CardHeader>
            <CardTitle>Share Your Creative Work</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpload} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Give your animation a catchy title"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tell us about your animation"
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="video">Video File</Label>
                <div className="border-2 border-dashed border-border rounded-2xl p-8 text-center hover:border-primary transition-colors">
                  <input
                    id="video"
                    type="file"
                    accept="video/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setVideoFile(file);
                      if (file) {
                        setVideoPreview(URL.createObjectURL(file));
                      }
                    }}
                    className="hidden"
                  />
                  <label
                    htmlFor="video"
                    className="cursor-pointer flex flex-col items-center gap-2"
                  >
                    {videoPreview ? (
                      <video src={videoPreview} className="h-40 rounded-lg" controls />
                    ) : (
                      <UploadIcon className="h-12 w-12 text-primary" />
                    )}
                    <div className="text-sm">
                      {videoFile ? (
                        <span className="text-foreground font-semibold">{videoFile.name}</span>
                      ) : (
                        <>
                          <span className="text-primary font-semibold">Click to upload</span>
                          <span className="text-muted-foreground"> or drag and drop</span>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      MP4, MOV, or AVI (max 100MB)
                    </p>
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="thumbnail">Thumbnail (Optional)</Label>
                <div className="border-2 border-dashed border-border rounded-2xl p-8 text-center hover:border-primary transition-colors">
                  <input
                    id="thumbnail"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setThumbnailFile(file);
                      if (file) {
                        setThumbnailPreview(URL.createObjectURL(file));
                      }
                    }}
                    className="hidden"
                  />
                  <label
                    htmlFor="thumbnail"
                    className="cursor-pointer flex flex-col items-center gap-2"
                  >
                    {thumbnailPreview ? (
                      <img src={thumbnailPreview} className="h-32 rounded-lg" alt="Thumbnail preview" />
                    ) : (
                      <UploadIcon className="h-12 w-12 text-primary" />
                    )}
                    <div className="text-sm">
                      {thumbnailFile ? (
                        <span className="text-foreground font-semibold">{thumbnailFile.name}</span>
                      ) : (
                        <>
                          <span className="text-primary font-semibold">Click to upload thumbnail</span>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      JPG, PNG (recommended 9:16 ratio)
                    </p>
                  </label>
                </div>
              </div>

              {loading && uploadProgress > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-foreground">Uploading...</span>
                    <span className="text-primary font-semibold">{uploadProgress}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <Button
                type="submit"
                className="w-full rounded-full"
                disabled={loading}
                size="lg"
              >
                {loading ? 'Uploading...' : 'Upload Animation'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <BottomNav />
    </div>
  );
};

export default Upload;
