import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Send, CheckCircle, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  content: string;
  message_type: string;
  created_at: string;
  sender_id: string;
  profiles: {
    name: string;
    email: string;
  };
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
  const { user, userRole } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
      .select('*, profiles(name, email)')
      .eq('ticket_id', id)
      .order('created_at', { ascending: true });

    if (error) {
      toast({
        title: 'Error fetching messages',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setMessages(data || []);
    }
    setIsLoading(false);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !id || !newMessage.trim()) return;

    setIsSending(true);

    const { error } = await supabase
      .from('messages')
      .insert({
        ticket_id: id,
        sender_id: user.id,
        message_type: 'text',
        content: newMessage.trim(),
      });

    if (error) {
      toast({
        title: 'Error sending message',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setNewMessage('');
    }

    setIsSending(false);
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
                      <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {ticket.status === 'pending' && (
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <Textarea
                  placeholder="Type your message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  rows={2}
                  className="resize-none flex-1"
                />
                <Button
                  type="submit"
                  disabled={isSending || !newMessage.trim()}
                  size="lg"
                  className="gap-2"
                >
                  {isSending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default TicketThread;
