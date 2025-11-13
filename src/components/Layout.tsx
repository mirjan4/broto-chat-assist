import { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LogOut, MessageSquare, User, LayoutDashboard, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user, userRole, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-primary">
                <MessageSquare className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-semibold">Support Desk</h1>
                <p className="text-xs text-muted-foreground">Brototype</p>
              </div>
            </div>
            
            {user && (
              <div className="flex items-center gap-3">
                {userRole === 'admin' && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant={location.pathname === '/admin-dashboard' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => navigate('/admin-dashboard')}
                      className="gap-2"
                    >
                      <LayoutDashboard className="h-4 w-4" />
                      Admin Dashboard
                    </Button>
                    <Button
                      variant={location.pathname === '/' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => navigate('/')}
                      className="gap-2"
                    >
                      <Users className="h-4 w-4" />
                      Staff View
                    </Button>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{user.email}</span>
                  {userRole && (
                    <Badge variant={userRole === 'staff' || userRole === 'admin' ? 'default' : 'secondary'} className="capitalize">
                      {userRole}
                    </Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={signOut}
                  className="gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
