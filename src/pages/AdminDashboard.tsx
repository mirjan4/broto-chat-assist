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
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart3, Clock, TrendingUp, Users, AlertCircle, CheckCircle, CalendarIcon, Filter, X } from 'lucide-react';
import { LineChart, Line, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatDistanceToNow, format, differenceInHours, subDays, startOfDay, endOfDay } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

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

interface FilterState {
  dateRange: {
    from: Date | null;
    to: Date | null;
  };
  status: 'all' | 'pending' | 'resolved';
  staffMember: string | null;
}

interface StaffMember {
  id: string;
  name: string;
  email: string;
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
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [filters, setFilters] = useState<FilterState>({
    dateRange: {
      from: subDays(new Date(), 30),
      to: new Date()
    },
    status: 'all',
    staffMember: null
  });

  useEffect(() => {
    if (!authLoading && userRole !== 'admin') {
      navigate('/');
      return;
    }
    
    if (!authLoading && userRole === 'admin') {
      loadStaffList();
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

  const loadStaffList = async () => {
    const { data: staffRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('role', ['staff', 'admin']);

    const staffIds = staffRoles?.map(r => r.user_id) || [];

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, email')
      .in('id', staffIds);

    setStaffList(profiles || []);
  };

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
    let query = supabase.from('tickets').select('id, status, created_at, updated_at');

    // Apply date range filter
    if (filters.dateRange.from) {
      query = query.gte('created_at', startOfDay(filters.dateRange.from).toISOString());
    }
    if (filters.dateRange.to) {
      query = query.lte('created_at', endOfDay(filters.dateRange.to).toISOString());
    }

    // Apply status filter
    if (filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }

    const { data: tickets, error } = await query;

    if (error) {
      toast({ title: 'Error fetching metrics', description: error.message, variant: 'destructive' });
      return;
    }

    // Apply staff filter
    let filteredTickets = tickets || [];
    if (filters.staffMember) {
      filteredTickets = await filterTicketsByStaff(filteredTickets, filters.staffMember);
    }

    const total = filteredTickets.length;
    const pending = filteredTickets.filter(t => t.status === 'pending').length;
    const resolved = filteredTickets.filter(t => t.status === 'resolved').length;
    
    const resolvedTickets = filteredTickets.filter(t => t.status === 'resolved');
    const avgResolutionHours = resolvedTickets.length > 0
      ? resolvedTickets.reduce((sum, t) => sum + differenceInHours(new Date(t.updated_at), new Date(t.created_at)), 0) / resolvedTickets.length
      : 0;

    setMetrics({ total, pending, resolved, avgResolutionHours });
  };

  const filterTicketsByStaff = async (tickets: any[], staffId: string) => {
    if (tickets.length === 0) return [];
    
    const { data: messages } = await supabase
      .from('messages')
      .select('ticket_id')
      .eq('sender_id', staffId)
      .in('ticket_id', tickets.map(t => t.id));

    const ticketIdsWithStaffReply = new Set(messages?.map(m => m.ticket_id));
    return tickets.filter(t => ticketIdsWithStaffReply.has(t.id));
  };

  const fetchTicketTrends = async () => {
    let query = supabase.from('tickets').select('id, created_at').order('created_at', { ascending: true });

    // Apply date range filter
    if (filters.dateRange.from) {
      query = query.gte('created_at', startOfDay(filters.dateRange.from).toISOString());
    }
    if (filters.dateRange.to) {
      query = query.lte('created_at', endOfDay(filters.dateRange.to).toISOString());
    }

    // Apply status filter
    if (filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }

    const { data: tickets, error } = await query;

    if (error) {
      toast({ title: 'Error fetching trends', description: error.message, variant: 'destructive' });
      return;
    }

    // Apply staff filter
    let filteredTickets = tickets || [];
    if (filters.staffMember) {
      filteredTickets = await filterTicketsByStaff(filteredTickets, filters.staffMember);
    }

    const dateMap = new Map<string, number>();
    filteredTickets.forEach(ticket => {
      const date = format(new Date(ticket.created_at), 'MMM dd');
      dateMap.set(date, (dateMap.get(date) || 0) + 1);
    });

    const trends = Array.from(dateMap.entries()).map(([date, count]) => ({ date, count }));
    setTicketTrends(trends);
  };

  const fetchCommonIssues = async () => {
    let query = supabase.from('tickets').select('id, subject, created_at');

    // Apply date range filter
    if (filters.dateRange.from) {
      query = query.gte('created_at', startOfDay(filters.dateRange.from).toISOString());
    }
    if (filters.dateRange.to) {
      query = query.lte('created_at', endOfDay(filters.dateRange.to).toISOString());
    }

    // Apply status filter
    if (filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }

    const { data: tickets, error } = await query;

    if (error) {
      toast({ title: 'Error fetching issues', description: error.message, variant: 'destructive' });
      return;
    }

    // Apply staff filter
    let filteredTickets = tickets || [];
    if (filters.staffMember) {
      filteredTickets = await filterTicketsByStaff(filteredTickets, filters.staffMember);
    }

    const subjectMap = new Map<string, number>();
    filteredTickets.forEach(ticket => {
      const subject = ticket.subject;
      subjectMap.set(subject, (subjectMap.get(subject) || 0) + 1);
    });

    const total = filteredTickets.length || 1;
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

    let staffIds = staffRoles?.map(r => r.user_id) || [];

    // If specific staff member selected, filter to just that staff member
    if (filters.staffMember) {
      staffIds = staffIds.filter(id => id === filters.staffMember);
    }

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
        let messagesQuery = supabase
          .from('messages')
          .select('ticket_id, created_at, tickets!inner(student_id, created_at, status)')
          .eq('sender_id', profile.id);

        // Apply date range filter to messages
        if (filters.dateRange.from) {
          messagesQuery = messagesQuery.gte('tickets.created_at', startOfDay(filters.dateRange.from).toISOString());
        }
        if (filters.dateRange.to) {
          messagesQuery = messagesQuery.lte('tickets.created_at', endOfDay(filters.dateRange.to).toISOString());
        }

        // Apply status filter
        if (filters.status !== 'all') {
          messagesQuery = messagesQuery.eq('tickets.status', filters.status);
        }

        const { data: messages } = await messagesQuery;

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

  const handleApplyFilters = () => {
    fetchAllAnalytics();
  };

  const handleResetFilters = () => {
    setFilters({
      dateRange: {
        from: subDays(new Date(), 30),
        to: new Date()
      },
      status: 'all',
      staffMember: null
    });
  };

  useEffect(() => {
    if (!authLoading && userRole === 'admin') {
      fetchAllAnalytics();
    }
  }, [filters]);

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

  const hasActiveFilters = 
    filters.status !== 'all' || 
    filters.staffMember !== null ||
    filters.dateRange.from?.getTime() !== subDays(new Date(), 30).setHours(0,0,0,0) ||
    filters.dateRange.to?.getTime() !== new Date().setHours(0,0,0,0);

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground">Comprehensive analytics and performance metrics</p>
          </div>
        </div>

        {/* Filter Bar */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
            <CardDescription>Filter analytics by date range, status, and staff member</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Date Range Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Date Range</label>
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("justify-start text-left font-normal", !filters.dateRange.from && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {filters.dateRange.from ? format(filters.dateRange.from, "MMM dd, yyyy") : "From"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={filters.dateRange.from || undefined}
                        onSelect={(date) => setFilters(prev => ({ ...prev, dateRange: { ...prev.dateRange, from: date || null } }))}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("justify-start text-left font-normal", !filters.dateRange.to && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {filters.dateRange.to ? format(filters.dateRange.to, "MMM dd, yyyy") : "To"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={filters.dateRange.to || undefined}
                        onSelect={(date) => setFilters(prev => ({ ...prev, dateRange: { ...prev.dateRange, to: date || null } }))}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button variant="ghost" size="sm" onClick={() => setFilters(prev => ({ ...prev, dateRange: { from: subDays(new Date(), 7), to: new Date() } }))}>
                    Last 7 days
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setFilters(prev => ({ ...prev, dateRange: { from: subDays(new Date(), 30), to: new Date() } }))}>
                    Last 30 days
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setFilters(prev => ({ ...prev, dateRange: { from: null, to: null } }))}>
                    All time
                  </Button>
                </div>
              </div>

              {/* Status Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select value={filters.status} onValueChange={(value: 'all' | 'pending' | 'resolved') => setFilters(prev => ({ ...prev, status: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Staff Member Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Staff Member</label>
                <Select value={filters.staffMember || 'all'} onValueChange={(value) => setFilters(prev => ({ ...prev, staffMember: value === 'all' ? null : value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Staff</SelectItem>
                    {staffList.map(staff => (
                      <SelectItem key={staff.id} value={staff.id}>
                        {staff.name} ({staff.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Active Filters Display */}
            {hasActiveFilters && (
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-sm text-muted-foreground">Active filters:</span>
                {filters.dateRange.from && (
                  <Badge variant="secondary" className="gap-1">
                    📅 {format(filters.dateRange.from, "MMM dd")} - {filters.dateRange.to ? format(filters.dateRange.to, "MMM dd") : "Now"}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setFilters(prev => ({ ...prev, dateRange: { from: subDays(new Date(), 30), to: new Date() } }))} />
                  </Badge>
                )}
                {filters.status !== 'all' && (
                  <Badge variant="secondary" className="gap-1">
                    🎫 {filters.status}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setFilters(prev => ({ ...prev, status: 'all' }))} />
                  </Badge>
                )}
                {filters.staffMember && (
                  <Badge variant="secondary" className="gap-1">
                    👤 {staffList.find(s => s.id === filters.staffMember)?.name}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setFilters(prev => ({ ...prev, staffMember: null }))} />
                  </Badge>
                )}
                <Button variant="ghost" size="sm" onClick={handleResetFilters}>
                  Reset All
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

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
