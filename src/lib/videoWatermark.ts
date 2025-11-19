/**
 * Adds ToonReels watermark and creator outro to a video using Canvas API
 */
export async function addWatermarkToVideo(
  videoBlob: Blob,
  creatorUsername: string
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }

    video.src = URL.createObjectURL(videoBlob);
    video.muted = true;
    
    video.onloadedmetadata = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const stream = canvas.captureStream(30); // 30 FPS
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 5000000
      });
      
      const chunks: Blob[] = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const watermarkedBlob = new Blob(chunks, { type: 'video/webm' });
        URL.revokeObjectURL(video.src);
        resolve(watermarkedBlob);
      };
      
      mediaRecorder.start();
      video.play();
      
      const drawFrame = () => {
        if (video.paused || video.ended) {
          mediaRecorder.stop();
          return;
        }
        
        // Draw video frame
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Calculate if we're in the outro (last 2 seconds)
        const isOutro = video.duration - video.currentTime <= 2;
        
        if (isOutro) {
          // Draw outro with creator username
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.fillRect(0, canvas.height - 100, canvas.width, 100);
          
          ctx.font = 'bold 32px Arial';
          ctx.fillStyle = 'white';
          ctx.textAlign = 'center';
          ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
          ctx.shadowBlur = 4;
          ctx.shadowOffsetX = 2;
          ctx.shadowOffsetY = 2;
          
          ctx.fillText('ToonReels', canvas.width / 2, canvas.height - 60);
          
          ctx.font = '24px Arial';
          ctx.fillText(`@${creatorUsername}`, canvas.width / 2, canvas.height - 25);
        } else {
          // Draw watermark in bottom-left corner
          ctx.font = 'bold 24px Arial';
          ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
          ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
          ctx.shadowBlur = 3;
          ctx.shadowOffsetX = 2;
          ctx.shadowOffsetY = 2;
          ctx.textAlign = 'left';
          ctx.fillText('ToonReels', 10, canvas.height - 10);
        }
        
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        
        requestAnimationFrame(drawFrame);
      };
      
      video.addEventListener('play', () => {
        drawFrame();
      });
    };
    
    video.onerror = () => {
      reject(new Error('Failed to load video'));
    };
  });
}
