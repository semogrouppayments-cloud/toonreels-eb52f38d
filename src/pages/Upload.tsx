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
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoFile) {
      toast.error('Please select a video file');
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Upload video to storage
      const fileExt = videoFile.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(fileName, videoFile);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('videos')
        .getPublicUrl(fileName);

      // Upload thumbnail if provided
      let thumbnailUrl = publicUrl;
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
      }

      // Create video record
      const { error: insertError } = await supabase
        .from('videos')
        .insert({
          creator_id: user.id,
          title,
          description,
          video_url: publicUrl,
          thumbnail_url: thumbnailUrl,
        });

      if (insertError) throw insertError;

      toast.success('Video uploaded successfully!');
      navigate('/feed');
    } catch (error: any) {
      toast.error(error.message || 'Upload failed');
    } finally {
      setLoading(false);
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

              <Button
                type="submit"
                className="w-full"
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
