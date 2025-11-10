import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, Clock, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface Ticket {
  id: string;
  subject: string;
  status: 'pending' | 'resolved';
  created_at: string;
  profiles: { name: string; email: string };
  messages: { id: string }[];
}

const StaffDashboard = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchTickets();
    
    // Subscribe to realtime updates
    const channel = supabase
      .channel('tickets-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets'
        },
        () => {
          fetchTickets();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchTickets = async () => {
    const { data, error } = await supabase
      .from('tickets')
      .select(`
        *,
        profiles (name, email),
        messages (id)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        title: 'Error fetching tickets',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setTickets(data || []);
    }
    setLoading(false);
  };

  const pendingTickets = tickets.filter(t => t.status === 'pending');
  const resolvedTickets = tickets.filter(t => t.status === 'resolved');

  const TicketCard = ({ ticket }: { ticket: Ticket }) => (
    <Card
      className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:-translate-y-1"
      onClick={() => navigate(`/ticket/${ticket.id}`)}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg mb-1 truncate">
              {ticket.subject}
            </CardTitle>
            <CardDescription className="flex items-center gap-2">
              <Users className="h-3 w-3" />
              {ticket.profiles.name}
            </CardDescription>
          </div>
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
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            <span>{ticket.messages.length} message{ticket.messages.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-3 w-3" />
            {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Staff Dashboard</h1>
          <p className="text-muted-foreground mt-1">Manage and respond to student tickets</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Tickets</CardDescription>
              <CardTitle className="text-3xl">{tickets.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Pending</CardDescription>
              <CardTitle className="text-3xl text-warning">{pendingTickets.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Resolved</CardDescription>
              <CardTitle className="text-3xl text-success">{resolvedTickets.length}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground mt-4">Loading tickets...</p>
          </div>
        ) : (
          <Tabs defaultValue="pending" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="pending">
                Pending ({pendingTickets.length})
              </TabsTrigger>
              <TabsTrigger value="resolved">
                Resolved ({resolvedTickets.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="space-y-4 mt-6 animate-fade-in">
              {pendingTickets.length === 0 ? (
                <Card className="text-center py-12 border-dashed">
                  <CardContent className="pt-6">
                    <MessageSquare className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">All caught up!</h3>
                    <p className="text-muted-foreground">
                      No pending tickets at the moment
                    </p>
                  </CardContent>
                </Card>
              ) : (
                pendingTickets.map((ticket) => <TicketCard key={ticket.id} ticket={ticket} />)
              )}
            </TabsContent>

            <TabsContent value="resolved" className="space-y-4 mt-6 animate-fade-in">
              {resolvedTickets.length === 0 ? (
                <Card className="text-center py-12 border-dashed">
                  <CardContent className="pt-6">
                    <MessageSquare className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No resolved tickets</h3>
                    <p className="text-muted-foreground">
                      Resolved tickets will appear here
                    </p>
                  </CardContent>
                </Card>
              ) : (
                resolvedTickets.map((ticket) => <TicketCard key={ticket.id} ticket={ticket} />)
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </Layout>
  );
};

export default StaffDashboard;
