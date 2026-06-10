import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4">
      <h1 className="text-6xl font-extrabold text-primary mb-4">404</h1>
      <p className="text-xl text-slate-600 mb-8">Oops! The page you are looking for does not exist.</p>
      <Link 
        to="/" 
        className="px-6 py-3 bg-primary text-white rounded-md hover:bg-primary-700 transition-colors"
      >
        Go back home
      </Link>
    </div>
  );
}
