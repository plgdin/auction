import { ResetPasswordForm } from '../components/forms/ResetPasswordForm';

export function ResetPassword() {
  return (
    <>
      <div className="mb-6 text-center">
        <h3 className="text-lg font-medium text-slate-900">Set new password</h3>
        <p className="mt-2 text-sm text-slate-600">
          Please enter your new password below.
        </p>
      </div>
      <ResetPasswordForm />
    </>
  );
}
