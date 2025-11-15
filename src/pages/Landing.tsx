import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare, Users, BarChart3, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';

const Landing = () => {
  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-primary">
              <MessageSquare className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">Brototype Support Desk</span>
          </div>
          <Link to="/auth">
            <Button variant="outline">Sign In</Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-primary bg-clip-text text-transparent">
          Student Support Made Simple
        </h1>
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          A comprehensive support ticket system designed for educational institutions. 
          Manage student queries, track issues, and provide timely assistance.
        </p>
        <div className="flex gap-4 justify-center">
          <Link to="/auth">
            <Button size="lg" className="text-lg px-8">
              Get Started
            </Button>
          </Link>
          <Link to="/auth">
            <Button variant="outline" size="lg" className="text-lg px-8">
              Try Demo
            </Button>
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <Card className="border-border/50">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>For Students</CardTitle>
              <CardDescription>
                Submit support tickets, attach media, and track the status of your queries in real-time.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-border/50">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <MessageSquare className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>For Staff</CardTitle>
              <CardDescription>
                Manage and respond to tickets efficiently with threaded conversations and media support.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-border/50">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <BarChart3 className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>For Admins</CardTitle>
              <CardDescription>
                Access analytics, invite staff members, and monitor overall support performance.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* Demo Accounts Section */}
      <section className="container mx-auto px-4 py-16">
        <Card className="max-w-3xl mx-auto border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Try Demo Accounts</CardTitle>
            <CardDescription>
              Test the system with pre-configured demo accounts for each role
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg border border-border/50 bg-background">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">🔴</span>
                  <h3 className="font-semibold">Admin Account</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Full analytics, staff management, and system oversight
                </p>
                <div className="space-y-1 text-sm font-mono bg-muted/50 p-2 rounded">
                  <div><span className="text-muted-foreground">Email:</span> admin@example.com</div>
                  <div><span className="text-muted-foreground">Password:</span> admin123</div>
                </div>
              </div>

              <div className="p-4 rounded-lg border border-border/50 bg-background">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">🔵</span>
                  <h3 className="font-semibold">Staff Account</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Ticket management and student support
                </p>
                <div className="space-y-1 text-sm font-mono bg-muted/50 p-2 rounded">
                  <div><span className="text-muted-foreground">Email:</span> staff@example.com</div>
                  <div><span className="text-muted-foreground">Password:</span> staff123</div>
                </div>
              </div>
            </div>

            <div className="text-center pt-4">
              <Link to="/auth">
                <Button size="lg" className="w-full md:w-auto">
                  Sign In to Get Started
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 mt-20">
        <div className="container mx-auto px-4 py-8 text-center text-muted-foreground">
          <p>© 2024 Brototype Support Desk. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
