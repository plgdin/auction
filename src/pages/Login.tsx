import { Link } from 'react-router-dom';
import { LoginForm } from '../components/forms/LoginForm';

export function Login() {
  return (
    <>
      <LoginForm />
      <div className="mt-6">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-slate-500">
              New to Auction e-Auction?
            </span>
          </div>
        </div>

        <div className="mt-6">
          <Link
            to="/auth/register"
            className="w-full flex justify-center py-2 px-4 border border-primary rounded-md shadow-sm text-sm font-medium text-primary bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
          >
            Create an account
          </Link>
        </div>
      </div>
    </>
  );
}
