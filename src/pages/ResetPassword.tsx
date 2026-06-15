import { Link } from 'react-router-dom';
import { ResetPasswordForm } from '../components/forms/ResetPasswordForm';

export function ResetPassword() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
          Set new password
        </h2>
        <p className="text-sm text-slate-500">
          Enter and confirm your new secure password below.
        </p>
      </div>

      <ResetPasswordForm />

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
