import { Link } from 'react-router-dom';
import { ForgotPasswordForm } from '../components/forms/ForgotPasswordForm';

export function ForgotPassword() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
          Reset password
        </h2>
        <p className="text-sm text-slate-500">
          Enter your email address and we will send you a link to reset your password.
        </p>
      </div>

      <ForgotPasswordForm />

      <div className="pt-2 text-center">
        <Link
          to="/auth/login"
          className="font-semibold text-primary hover:underline text-sm transition-all duration-200"
        >
          Return to sign in
        </Link>
      </div>
    </div>
  );
}
