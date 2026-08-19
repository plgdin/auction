import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { LoginForm } from '../components/forms/LoginForm';

export function Login() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, profile } = useAuthStore();
  const isAdminLogin = location.pathname.includes('adminlogin');

  useEffect(() => {
    if (isAuthenticated && profile) {
      const searchParams = new URLSearchParams(location.search);
      const redirectUrl = searchParams.get('redirect') || (location.state as any)?.from;

      if (profile.role === 'admin' || profile.role === 'superadmin') {
        navigate('/admin');
      } else if (redirectUrl) {
        const target = typeof redirectUrl === 'string' 
          ? redirectUrl 
          : (redirectUrl.pathname ? `${redirectUrl.pathname}${redirectUrl.search || ''}` : '/dashboard');
        navigate(target, { replace: true });
      } else {
        navigate('/dashboard');
      }
    }
  }, [isAuthenticated, profile, navigate, location]);

  return (
    <div className="space-y-5">
      <div className="space-y-1.5 text-center md:text-left">
        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
          {isAdminLogin ? 'System Administration' : 'Sign in to your account'}
        </h2>
        <p className="text-xs sm:text-sm text-slate-500">
          {isAdminLogin 
            ? 'Only administrators are allowed to access this terminal.' 
            : 'Enter your credentials to access the bidding terminal.'}
        </p>
      </div>
      
      <LoginForm isAdminLogin={isAdminLogin} />
      
      {!isAdminLogin && (
        <div className="pt-1 text-center">
          <p className="text-xs sm:text-sm text-slate-500">
            New to Lelam?{' '}
            <Link
              to={`/auth/register${location.search}`}
              className="font-bold text-primary hover:underline transition-all duration-200"
            >
              Create an account
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}

