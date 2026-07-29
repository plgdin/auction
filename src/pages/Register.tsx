import { Link, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { RegisterForm } from '../components/forms/RegisterForm';

export function Register() {
  const navigate = useNavigate();
  const { isAuthenticated, profile } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated && profile) {
      if (profile.role === 'admin' || profile.role === 'superadmin') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    }
  }, [isAuthenticated, profile, navigate]);
  return (
    <div className="space-y-5">
      <div className="space-y-1.5 text-center md:text-left">
        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
          Create your account
        </h2>
        <p className="text-xs sm:text-sm text-slate-500">
          Enter your details below to set up your bidder profile.
        </p>
      </div>

      <RegisterForm />

      <div className="pt-1 text-center">
        <p className="text-xs sm:text-sm text-slate-500">
          Already have an account?{' '}
          <Link
            to="/auth/login"
            className="font-bold text-primary hover:underline transition-all duration-200"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
