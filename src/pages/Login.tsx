import { Link, useLocation } from 'react-router-dom';
import { LoginForm } from '../components/forms/LoginForm';

export function Login() {
  const location = useLocation();
  const isAdminLogin = location.pathname.includes('adminlogin');

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
          {isAdminLogin ? 'System Administration' : 'Sign in to your account'}
        </h2>
        <p className="text-sm text-slate-500">
          {isAdminLogin 
            ? 'Only administrators are allowed to access this terminal.' 
            : 'Enter your credentials to access the bidding terminal.'}
        </p>
      </div>
      
      <LoginForm isAdminLogin={isAdminLogin} />
      
      {!isAdminLogin && (
        <div className="pt-2 text-center">
          <p className="text-sm text-slate-500">
            New to Lelam?{' '}
            <Link
              to="/auth/register"
              className="font-semibold text-primary hover:underline transition-all duration-200"
            >
              Create an account
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}

