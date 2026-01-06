import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Heart, Send, Flag, Trash2, Ban } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { useIsMobile } from '@/hooks/use-mobile';

const commentSchema = z.object({
  content: z.string()
    .trim()
    .min(1, 'Comment cannot be empty')
    .max(500, 'Comment must be less than 500 characters')
});

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  parent_id: string | null;
  profiles: {
    username: string;
  };
}

interface CommentsSheetProps {
  videoId: string;
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
}

const CommentsSheet = ({ videoId, isOpen, onClose, currentUserId }: CommentsSheetProps) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isOpen) {
      fetchComments();
      fetchBlockedUsers();
    }
  }, [isOpen, videoId]);

  const fetchBlockedUsers = async () => {
    if (!currentUserId) return;
    
    const { data } = await supabase
      .from('blocks')
      .select('blocked_id')
      .eq('blocker_id', currentUserId);
    
    setBlockedUsers(data?.map(b => b.blocked_id) || []);
  };

  const fetchComments = async () => {
    const { data } = await supabase
      .from('comments')
      .select(`
        *,
        profiles(username)
      `)
      .eq('video_id', videoId)
      .order('created_at', { ascending: false });

    setComments(data || []);
  };

  const handleSubmit = async () => {
    try {
      const validation = commentSchema.safeParse({ content: newComment });
      
      if (!validation.success) {
        toast.error(validation.error.issues[0].message);
        return;
      }

      await supabase.from('comments').insert({
        video_id: videoId,
        user_id: currentUserId,
        content: validation.data.content,
        parent_id: replyTo
      });

      setNewComment('');
      setReplyTo(null);
      fetchComments();
      toast.success('Comment posted!');
    } catch (error) {
      toast.error('Failed to post comment');
    }
  };

  const handleLikeComment = async (commentId: string) => {
    try {
      await supabase.from('comment_likes').insert({
        comment_id: commentId,
        user_id: currentUserId
      });
      toast.success('Comment liked!');
    } catch (error) {
      // Already liked or error
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await supabase.from('comments').delete().eq('id', commentId);
      fetchComments();
      toast.success('Comment deleted');
    } catch (error) {
      toast.error('Failed to delete comment');
    }
  };

  const handleReportComment = async (commentId: string) => {
    try {
      await supabase.from('reports').insert({
        reporter_id: currentUserId,
        reported_type: 'comment',
        reported_id: commentId,
        reason: 'Inappropriate comment'
      });
      toast.success('Comment reported');
    } catch (error) {
      toast.error('Failed to report comment');
    }
  };

  const handleBlockUser = async (userId: string) => {
    if (!currentUserId || userId === currentUserId) return;
    
    try {
      await supabase.from('blocks').insert({
        blocker_id: currentUserId,
        blocked_id: userId
      });
      setBlockedUsers(prev => [...prev, userId]);
      toast.success('User blocked');
    } catch (error) {
      toast.error('Failed to block user');
    }
  };

  const topLevelComments = comments.filter(c => !c.parent_id);
  const getReplies = (parentId: string) => comments.filter(c => c.parent_id === parentId);

  // Filter out comments from blocked users
  const visibleComments = topLevelComments.filter(c => !blockedUsers.includes(c.user_id));

  const CommentContent = () => (
    <>
      <SheetHeader>
        <SheetTitle className="text-2xl font-black">Comments</SheetTitle>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto space-y-4 py-4">
        {visibleComments.map((comment) => (
          <div key={comment.id} className="space-y-2">
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center font-bold text-sm flex-shrink-0 text-primary-foreground">
                {comment.profiles.username[0].toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm">{comment.profiles.username}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(comment.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm mb-2">{comment.content}</p>
                
                <div className="flex items-center gap-1 flex-wrap">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleLikeComment(comment.id)}
                    className="h-7 px-2"
                  >
                    <Heart className="h-3 w-3 mr-1" />
                    Like
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setReplyTo(comment.id)}
                    className="h-7 px-2"
                  >
                    Reply
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleReportComment(comment.id)}
                    className="h-7 px-2"
                  >
                    <Flag className="h-3 w-3" />
                  </Button>
                  {comment.user_id !== currentUserId && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleBlockUser(comment.user_id)}
                      className="h-7 px-2 text-destructive"
                    >
                      <Ban className="h-3 w-3" />
                    </Button>
                  )}
                  {comment.user_id === currentUserId && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteComment(comment.id)}
                      className="h-7 px-2 text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Replies */}
            {getReplies(comment.id)
              .filter(reply => !blockedUsers.includes(reply.user_id))
              .map((reply) => (
              <div key={reply.id} className="ml-12 flex gap-3">
                <div className="h-6 w-6 rounded-full bg-accent flex items-center justify-center font-bold text-xs flex-shrink-0">
                  {reply.profiles.username[0].toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-xs">{reply.profiles.username}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(reply.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs">{reply.content}</p>
                  {reply.user_id !== currentUserId && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleBlockUser(reply.user_id)}
                      className="h-6 px-2 text-destructive mt-1"
                    >
                      <Ban className="h-3 w-3 mr-1" />
                      <span className="text-xs">Block</span>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="border-t pt-4 mt-4">
        {replyTo && (
          <div className="mb-2 text-sm text-muted-foreground flex items-center gap-2">
            Replying to comment
            <Button size="sm" variant="ghost" onClick={() => setReplyTo(null)}>
              Cancel
            </Button>
          </div>
        )}
        <div className="flex gap-2">
          <Input
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
          />
          <Button onClick={handleSubmit} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  );

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent 
        side={isMobile ? "bottom" : "right"} 
        className={isMobile ? "h-[80vh] rounded-t-3xl" : "w-[400px] sm:w-[450px]"}
      >
        <CommentContent />
      </SheetContent>
    </Sheet>
  );
};

export default CommentsSheet;