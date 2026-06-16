import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { authService } from '../../services/authService';
import { Mail, Lock, Loader2, LogIn } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { setSession } = useAuthStore();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const { session } = await authService.signIn(data.email, data.password);
      setSession(session);
      navigate('/dashboard');
    } catch (error: any) {
      setAuthError(error.message || 'Failed to sign in');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {authError && (
        <div className="bg-destructive/10 border border-destructive/25 text-destructive px-4 py-3 rounded-xl text-sm">
          {authError}
        </div>
      )}
      
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Email address</label>
        <div className="relative rounded-xl shadow-xs">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Mail className="h-5 w-5" />
          </div>
          <input
            {...register('email')}
            type="email"
            placeholder="name@company.com"
            className="block w-full pl-10.5 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white transition-all duration-200 text-sm"
          />
        </div>
        {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>}
      </div>

      <div>
        <div className="flex justify-between items-center mb-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">Password</label>
          <button
            type="button"
            onClick={() => navigate('/auth/forgot-password')}
            className="text-xs font-medium text-primary hover:text-primary-700 transition-colors"
          >
            Forgot password?
          </button>
        </div>
        <div className="relative rounded-xl shadow-xs">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Lock className="h-5 w-5" />
          </div>
          <input
            {...register('password')}
            type="password"
            placeholder="••••••••"
            className="block w-full pl-10.5 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white transition-all duration-200 text-sm"
          />
        </div>
        {errors.password && <p className="mt-1 text-xs text-destructive">{errors.password.message}</p>}
      </div>

      <div className="flex items-center">
        <div className="relative flex items-center justify-center">
          <input
            id="remember-me"
            name="remember-me"
            type="checkbox"
            className="peer h-5 w-5 rounded-full border border-slate-300 text-primary bg-white focus:outline-none checked:bg-primary checked:border-primary cursor-pointer appearance-none transition-all duration-200 shadow-2xs"
          />
          <svg
            className="absolute h-3 w-3 text-white pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity duration-200"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth="3.5"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <label htmlFor="remember-me" className="ml-2.5 block text-sm text-slate-650 select-none cursor-pointer">
          Keep me signed in for 30 days
        </label>
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-primary hover:bg-primary/95 hover:shadow-lg hover:shadow-primary/20 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all duration-200 cursor-pointer disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
              Signing in...
            </>
          ) : (
            <>
              Sign in
              <LogIn className="ml-2 h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </form>
  );
}
