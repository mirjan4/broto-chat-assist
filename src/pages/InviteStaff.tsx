import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { Shield, ArrowLeft } from 'lucide-react';

export default function InviteStaff() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'staff' | 'admin'>('staff');
  const { userRole, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Only staff and admin can access this page
  if (!user || (userRole !== 'staff' && userRole !== 'admin')) {
    navigate('/');
    return null;
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Call edge function to create staff account with proper logging
      const { data, error } = await supabase.functions.invoke('invite-staff', {
        body: {
          email,
          password,
          name,
          role,
        }
      });

      if (error) throw error;

      toast({
        title: "Staff member invited",
        description: `${name} has been created as ${role}.`,
      });

      // Reset form
      setEmail('');
      setName('');
      setPassword('');
      setRole('staff');
    } catch (error: any) {
      console.error('Error inviting staff:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to invite staff member",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="container max-w-2xl py-8">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              <CardTitle>Invite Staff Member</CardTitle>
            </div>
            <CardDescription>
              Create a new staff or admin account. Only staff and admin users can invite new staff members.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Enter full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="staff@brototype.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="invite-password">Initial Password</Label>
                <Input
                  id="invite-password"
                  type="password"
                  placeholder="Create a secure password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <p className="text-xs text-muted-foreground">
                  The user should change this password after first login.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Role</Label>
                <RadioGroup value={role} onValueChange={(value) => setRole(value as 'staff' | 'admin')}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="staff" id="role-staff" />
                    <Label htmlFor="role-staff" className="font-normal cursor-pointer">
                      Staff - Can view and respond to all tickets
                    </Label>
                  </div>
                  {userRole === 'admin' && (
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="admin" id="role-admin" />
                      <Label htmlFor="role-admin" className="font-normal cursor-pointer">
                        Admin - Full system access including staff management
                      </Label>
                    </div>
                  )}
                </RadioGroup>
              </div>

              <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                <p className="text-sm text-destructive">
                  <strong>Security:</strong> All invitation attempts are logged. Only authorized staff can create new accounts.
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Creating Account..." : "Create Staff Account"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
