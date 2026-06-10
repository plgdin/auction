import { Link } from 'react-router-dom';
import { RegisterForm } from '../components/forms/RegisterForm';

export function Register() {
  return (
    <>
      <div className="mb-6 text-center">
        <h3 className="text-lg font-medium text-slate-900">Sign up for an account</h3>
      </div>
      <RegisterForm />
      <div className="mt-6">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-slate-500">
              Already have an account?
            </span>
          </div>
        </div>

        <div className="mt-6">
          <Link
            to="/auth/login"
            className="w-full flex justify-center py-2 px-4 border border-primary rounded-md shadow-sm text-sm font-medium text-primary bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
          >
            Sign in
          </Link>
        </div>
      </div>
    </>
  );
}
