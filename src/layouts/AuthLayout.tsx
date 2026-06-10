import { Outlet } from 'react-router-dom';
import { Link } from 'react-router-dom';

export function AuthLayout() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link to="/" className="text-3xl font-bold text-primary tracking-tight">
          Auction e-Auction
        </Link>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900">
          Sign in to your account
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
