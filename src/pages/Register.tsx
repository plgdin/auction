import { Link } from 'react-router-dom';
import { RegisterForm } from '../components/forms/RegisterForm';

export function Register() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
          Create your account
        </h2>
        <p className="text-sm text-slate-500">
          Enter your details below to set up your bidder profile.
        </p>
      </div>

      <RegisterForm />

      <div className="pt-2 text-center">
        <p className="text-sm text-slate-500">
          Already have an account?{' '}
          <Link
            to="/auth/login"
            className="font-semibold text-primary hover:underline transition-all duration-200"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
