import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3, Clock, TrendingUp, Users, AlertCircle, CheckCircle } from 'lucide-react';
import { LineChart, Line, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatDistanceToNow, format, differenceInHours } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface TicketMetrics {
  total: number;
  pending: number;
  resolved: number;
  avgResolutionHours: number;
}

interface TicketTrend {
  date: string;
  count: number;
}

interface CommonIssue {
  subject: string;
  count: number;
  percentage: number;
}

interface StaffPerformance {
  id: string;
  name: string;
  email: string;
  ticketsHandled: number;
  avgResponseMinutes: number;
  resolvedCount: number;
  resolutionRate: number;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--warning))', 'hsl(var(--success))', 'hsl(var(--accent))'];

const AdminDashboard = () => {
  const { userRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [metrics, setMetrics] = useState<TicketMetrics | null>(null);
  const [ticketTrends, setTicketTrends] = useState<TicketTrend[]>([]);
  const [commonIssues, setCommonIssues] = useState<CommonIssue[]>([]);
  const [staffPerformance, setStaffPerformance] = useState<StaffPerformance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && userRole !== 'admin') {
      navigate('/');
      return;
    }
    
    if (!authLoading && userRole === 'admin') {
      fetchAllAnalytics();
      
      // Subscribe to realtime updates
      const channel = supabase
        .channel('admin-analytics-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => fetchAllAnalytics())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => fetchAllAnalytics())
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [userRole, authLoading, navigate]);

  const fetchAllAnalytics = async () => {
    setLoading(true);
    await Promise.all([
      fetchMetrics(),
      fetchTicketTrends(),
      fetchCommonIssues(),
      fetchStaffPerformance(),
    ]);
    setLoading(false);
  };

  const fetchMetrics = async () => {
    const { data: tickets, error } = await supabase
      .from('tickets')
      .select('id, status, created_at, updated_at');

    if (error) {
      toast({ title: 'Error fetching metrics', description: error.message, variant: 'destructive' });
      return;
    }

    const total = tickets?.length || 0;
    const pending = tickets?.filter(t => t.status === 'pending').length || 0;
    const resolved = tickets?.filter(t => t.status === 'resolved').length || 0;
    
    const resolvedTickets = tickets?.filter(t => t.status === 'resolved') || [];
    const avgResolutionHours = resolvedTickets.length > 0
      ? resolvedTickets.reduce((sum, t) => sum + differenceInHours(new Date(t.updated_at), new Date(t.created_at)), 0) / resolvedTickets.length
      : 0;

    setMetrics({ total, pending, resolved, avgResolutionHours });
  };

  const fetchTicketTrends = async () => {
    const { data: tickets, error } = await supabase
      .from('tickets')
      .select('created_at')
      .order('created_at', { ascending: true });

    if (error) {
      toast({ title: 'Error fetching trends', description: error.message, variant: 'destructive' });
      return;
    }

    const dateMap = new Map<string, number>();
    tickets?.forEach(ticket => {
      const date = format(new Date(ticket.created_at), 'MMM dd');
      dateMap.set(date, (dateMap.get(date) || 0) + 1);
    });

    const trends = Array.from(dateMap.entries())
      .slice(-30)
      .map(([date, count]) => ({ date, count }));

    setTicketTrends(trends);
  };

  const fetchCommonIssues = async () => {
    const { data: tickets, error } = await supabase
      .from('tickets')
      .select('subject');

    if (error) {
      toast({ title: 'Error fetching issues', description: error.message, variant: 'destructive' });
      return;
    }

    const subjectMap = new Map<string, number>();
    tickets?.forEach(ticket => {
      const subject = ticket.subject;
      subjectMap.set(subject, (subjectMap.get(subject) || 0) + 1);
    });

    const total = tickets?.length || 1;
    const issues = Array.from(subjectMap.entries())
      .map(([subject, count]) => ({
        subject,
        count,
        percentage: parseFloat(((count / total) * 100).toFixed(2)),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    setCommonIssues(issues);
  };

  const fetchStaffPerformance = async () => {
    const { data: staffRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('role', ['staff', 'admin']);

    if (rolesError) {
      toast({ title: 'Error fetching staff', description: rolesError.message, variant: 'destructive' });
      return;
    }

    const staffIds = staffRoles?.map(r => r.user_id) || [];

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, name, email')
      .in('id', staffIds);

    if (profilesError) {
      toast({ title: 'Error fetching profiles', description: profilesError.message, variant: 'destructive' });
      return;
    }

    const performance = await Promise.all(
      (profiles || []).map(async (profile) => {
        const { data: messages } = await supabase
          .from('messages')
          .select('ticket_id, created_at, tickets!inner(student_id, created_at, status)')
          .eq('sender_id', profile.id);

        const uniqueTickets = new Set(messages?.map(m => m.ticket_id) || []);
        const ticketsHandled = uniqueTickets.size;

        const responseTimes = messages?.map(m => {
          const ticket = m.tickets as unknown as { created_at: string; student_id: string; status: string };
          if (ticket.student_id === profile.id) return null;
          return differenceInHours(new Date(m.created_at), new Date(ticket.created_at)) * 60;
        }).filter(t => t !== null) || [];

        const avgResponseMinutes = responseTimes.length > 0
          ? responseTimes.reduce((sum, t) => sum + (t || 0), 0) / responseTimes.length
          : 0;

        const { data: resolvedTickets } = await supabase
          .from('tickets')
          .select('id')
          .in('id', Array.from(uniqueTickets))
          .eq('status', 'resolved');

        const resolvedCount = resolvedTickets?.length || 0;
        const resolutionRate = ticketsHandled > 0 ? parseFloat(((resolvedCount / ticketsHandled) * 100).toFixed(2)) : 0;

        return {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          ticketsHandled,
          avgResponseMinutes: parseFloat(avgResponseMinutes.toFixed(2)),
          resolvedCount,
          resolutionRate,
        };
      })
    );

    setStaffPerformance(performance.sort((a, b) => b.ticketsHandled - a.ticketsHandled));
  };

  const statusData = metrics ? [
    { name: 'Pending', value: metrics.pending },
    { name: 'Resolved', value: metrics.resolved },
  ] : [];

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-12 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
          </div>
          <Skeleton className="h-96" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground">Comprehensive analytics and performance metrics</p>
          </div>
        </div>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-card to-card/80">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics?.total || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {metrics?.pending || 0} pending, {metrics?.resolved || 0} resolved
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-card to-card/80">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Resolution Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics?.avgResolutionHours.toFixed(1) || 0}h</div>
              <p className="text-xs text-muted-foreground mt-1">Average time to resolve</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-card to-card/80">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Tickets</CardTitle>
              <AlertCircle className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics?.pending || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Awaiting response</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-card to-card/80">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Staff</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{staffPerformance.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Staff members</p>
            </CardContent>
          </Card>
        </div>

        {/* Analytics Tabs */}
        <Tabs defaultValue="trends" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="trends">Ticket Trends</TabsTrigger>
            <TabsTrigger value="distribution">Status Distribution</TabsTrigger>
            <TabsTrigger value="issues">Common Issues</TabsTrigger>
            <TabsTrigger value="staff">Staff Performance</TabsTrigger>
          </TabsList>

          <TabsContent value="trends" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Ticket Creation Trends</CardTitle>
                <CardDescription>Tickets created over the last 30 days</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={ticketTrends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} name="Tickets" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="distribution" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Ticket Status Distribution</CardTitle>
                <CardDescription>Current breakdown of ticket statuses</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={120}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="issues" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Most Common Issues</CardTitle>
                <CardDescription>Top 10 ticket subjects by frequency</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[60%]">Subject</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                      <TableHead className="text-right">Percentage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commonIssues.map((issue, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{issue.subject}</TableCell>
                        <TableCell className="text-right">{issue.count}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary">{issue.percentage}%</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="staff" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Staff Performance Metrics</CardTitle>
                <CardDescription>Individual staff member statistics and performance</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-right">Tickets Handled</TableHead>
                      <TableHead className="text-right">Avg Response Time</TableHead>
                      <TableHead className="text-right">Resolved</TableHead>
                      <TableHead className="text-right">Resolution Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {staffPerformance.map((staff) => (
                      <TableRow key={staff.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{staff.name}</div>
                            <div className="text-xs text-muted-foreground">{staff.email}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline">{staff.ticketsHandled}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {staff.avgResponseMinutes > 0 ? `${staff.avgResponseMinutes.toFixed(0)}m` : 'N/A'}
                        </TableCell>
                        <TableCell className="text-right">{staff.resolvedCount}</TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant={staff.resolutionRate >= 70 ? 'default' : 'secondary'}
                            className={staff.resolutionRate >= 70 ? 'bg-success text-success-foreground' : ''}
                          >
                            {staff.resolutionRate}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default AdminDashboard;
