import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import StudentDashboard from './StudentDashboard';
import StaffDashboard from './StaffDashboard';
import Landing from './Landing';

const Index = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && userRole === 'admin') {
      navigate('/admin-dashboard');
    }
  }, [userRole, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Landing />;
  }
  
  return userRole === 'staff' ? <StaffDashboard /> : <StudentDashboard />;
};

export default Index;
