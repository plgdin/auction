import { Link } from 'react-router-dom';
import { ForgotPasswordForm } from '../components/forms/ForgotPasswordForm';

export function ForgotPassword() {
  return (
    <>
      <div className="mb-6 text-center">
        <h3 className="text-lg font-medium text-slate-900">Reset your password</h3>
        <p className="mt-2 text-sm text-slate-600">
          Enter your email address and we will send you a link to reset your password.
        </p>
      </div>
      <ForgotPasswordForm />
      <div className="mt-6 text-center">
        <Link
          to="/auth/login"
          className="font-medium text-primary hover:text-primary-700 text-sm"
        >
          Return to sign in
        </Link>
      </div>
    </>
  );
}
