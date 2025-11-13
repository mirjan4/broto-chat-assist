import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Send, CheckCircle, Loader2, Paperclip, X, FileText, Image as ImageIcon } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { MediaPreview } from '@/components/MediaPreview';

interface MediaAsset {
  id: string;
  file_type: 'image' | 'pdf';
  storage_path: string;
}

interface Message {
  id: string;
  content: string | null;
  message_type: string;
  created_at: string;
  sender_id: string;
  profiles: {
    name: string;
    email: string;
  };
  media_assets?: MediaAsset[];
}

interface Ticket {
  id: string;
  subject: string;
  status: 'pending' | 'resolved';
  created_at: string;
  student_id: string;
  profiles: {
    name: string;
    email: string;
  };
}

const TicketThread = () => {
  const { id } = useParams<{ id: string }>();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const { user, userRole } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (id && user) {
      fetchTicket();
      fetchMessages();
      
      // Subscribe to realtime message updates
      const channel = supabase
        .channel(`messages-${id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `ticket_id=eq.${id}`
          },
          () => {
            fetchMessages();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [id, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchTicket = async () => {
    if (!id) return;

    const { data, error } = await supabase
      .from('tickets')
      .select('*, profiles(name, email)')
      .eq('id', id)
      .single();

    if (error) {
      toast({
        title: 'Error fetching ticket',
        description: error.message,
        variant: 'destructive',
      });
      navigate('/');
    } else {
      setTicket(data);
    }
  };

  const fetchMessages = async () => {
    if (!id) return;

    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        profiles(name, email),
        media_assets(*)
      `)
      .eq('ticket_id', id)
      .order('created_at', { ascending: true });

    if (error) {
      toast({
        title: 'Error fetching messages',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setMessages(data as Message[] || []);
    }
    setIsLoading(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => {
      const isValidType = file.type.startsWith('image/') || file.type === 'application/pdf';
      const isValidSize = file.size <= 5 * 1024 * 1024;
      
      if (!isValidType) {
        toast({
          title: "Invalid file type",
          description: `${file.name} is not an image or PDF`,
          variant: "destructive",
        });
      }
      if (!isValidSize) {
        toast({
          title: "File too large",
          description: `${file.name} exceeds 5MB limit`,
          variant: "destructive",
        });
      }
      
      return isValidType && isValidSize;
    });
    
    setSelectedFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !id || (!newMessage.trim() && selectedFiles.length === 0)) return;

    setIsSending(true);
    setIsUploading(selectedFiles.length > 0);

    try {
      // Create the message first
      const { data: messageData, error: messageError } = await supabase
        .from('messages')
        .insert({
          ticket_id: id,
          sender_id: user.id,
          message_type: 'text',
          content: newMessage.trim() || null,
        })
        .select()
        .single();

      if (messageError) throw messageError;

      // Upload files if any
      if (selectedFiles.length > 0) {
        for (const file of selectedFiles) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${user.id}/${messageData.id}/${crypto.randomUUID()}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('ticket-attachments')
            .upload(fileName, file);

          if (uploadError) throw uploadError;

          // Create media asset record
          const fileType = file.type.startsWith('image/') ? 'image' : 'pdf';
          const { error: mediaError } = await supabase
            .from('media_assets')
            .insert({
              message_id: messageData.id,
              file_type: fileType,
              storage_path: fileName
            });

          if (mediaError) throw mediaError;
        }
      }

      setNewMessage('');
      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error: any) {
      toast({
        title: 'Error sending message',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
      setIsUploading(false);
    }
  };

  const handleResolveTicket = async () => {
    if (!id) return;

    setIsResolving(true);

    const { error } = await supabase
      .from('tickets')
      .update({ status: 'resolved' })
      .eq('id', id);

    if (error) {
      toast({
        title: 'Error resolving ticket',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Ticket resolved!',
        description: 'This ticket has been marked as resolved.',
      });
      fetchTicket();
    }

    setIsResolving(false);
  };

  if (isLoading || !ticket) {
    return (
      <Layout>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground mt-4">Loading ticket...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-4">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>

        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <CardTitle className="text-xl mb-2">{ticket.subject}</CardTitle>
                <CardDescription>
                  Created by {ticket.profiles.name} • {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={ticket.status === 'resolved' ? 'default' : 'secondary'}
                  className={
                    ticket.status === 'resolved'
                      ? 'bg-success text-success-foreground'
                      : 'bg-warning text-warning-foreground'
                  }
                >
                  {ticket.status === 'pending' ? 'Pending' : 'Resolved'}
                </Badge>
                {userRole === 'staff' && ticket.status === 'pending' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleResolveTicket}
                    disabled={isResolving}
                    className="gap-2"
                  >
                    {isResolving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4" />
                    )}
                    Mark Resolved
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
            <div className="space-y-4 mb-6 max-h-[500px] overflow-y-auto pr-2">
              {messages.map((message) => {
                const isOwnMessage = message.sender_id === user?.id;
                return (
                  <div
                    key={message.id}
                    className={cn(
                      'flex gap-3 animate-slide-up',
                      isOwnMessage ? 'justify-end' : 'justify-start'
                    )}
                  >
                    <div
                      className={cn(
                        'max-w-[70%] rounded-2xl px-4 py-3 shadow-sm',
                        isOwnMessage
                          ? 'bg-gradient-primary text-primary-foreground'
                          : 'bg-secondary text-secondary-foreground'
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium opacity-90">
                          {message.profiles.name}
                        </span>
                        <span className="text-xs opacity-60">
                          {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      {message.content && (
                        <p className="text-sm whitespace-pre-wrap break-words mb-2">{message.content}</p>
                      )}
                      
                      {/* Display attached files */}
                      {message.media_assets && message.media_assets.length > 0 && (
                        <div className="space-y-2 mt-2">
                          {message.media_assets.map((asset) => (
                            <MediaPreview key={asset.id} asset={asset} />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {ticket.status === 'pending' && (
              <form onSubmit={handleSendMessage} className="space-y-3">
                {/* File preview */}
                {selectedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedFiles.map((file, index) => (
                      <div key={index} className="flex items-center gap-2 bg-muted px-3 py-2 rounded-md">
                        {file.type.startsWith('image/') ? (
                          <ImageIcon className="h-4 w-4" />
                        ) : (
                          <FileText className="h-4 w-4" />
                        )}
                        <span className="text-sm truncate max-w-[150px]">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Type your message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    rows={2}
                    className="resize-none flex-1"
                    disabled={isSending}
                  />
                  <div className="flex flex-col gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,.pdf"
                      multiple
                      onChange={handleFileSelect}
                      className="hidden"
                      id="file-upload"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isSending}
                    >
                      <Paperclip className="h-4 w-4" />
                    </Button>
                    <Button
                      type="submit"
                      disabled={isSending || (!newMessage.trim() && selectedFiles.length === 0)}
                      size="lg"
                      className="gap-2"
                    >
                      {isUploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : isSending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default TicketThread;