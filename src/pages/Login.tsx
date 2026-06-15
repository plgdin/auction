import { Link } from 'react-router-dom';
import { LoginForm } from '../components/forms/LoginForm';

export function Login() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
          Sign in to your account
        </h2>
        <p className="text-sm text-slate-500">
          Enter your credentials to access the bidding terminal.
        </p>
      </div>
      
      <LoginForm />
      
      <div className="pt-2 text-center">
        <p className="text-sm text-slate-500">
          New to Auction e-Auction?{' '}
          <Link
            to="/auth/register"
            className="font-semibold text-primary hover:underline transition-all duration-200"
          >
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
