import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { authService } from '../../services/authService';

const registerSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export function RegisterForm() {
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormValues) => {
    setIsLoading(true);
    setAuthError(null);
    try {
      await authService.signUp(data.email, data.password, data.firstName, data.lastName);
      setSuccess(true);
      setTimeout(() => navigate('/auth/login'), 3000);
    } catch (error: any) {
      setAuthError(error.message || 'Failed to register');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center">
        <h3 className="text-xl font-medium text-slate-900 mb-2">Registration Successful!</h3>
        <p className="text-slate-600">Please check your email to verify your account.</p>
        <p className="text-sm text-slate-500 mt-4">Redirecting to login...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {authError && (
        <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded text-sm">
          {authError}
        </div>
      )}
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">First Name</label>
          <input
            {...register('firstName')}
            className="mt-1 appearance-none block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
          />
          {errors.firstName && <p className="mt-1 text-sm text-destructive">{errors.firstName.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Last Name</label>
          <input
            {...register('lastName')}
            className="mt-1 appearance-none block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
          />
          {errors.lastName && <p className="mt-1 text-sm text-destructive">{errors.lastName.message}</p>}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">Email address</label>
        <input
          {...register('email')}
          type="email"
          className="mt-1 appearance-none block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
        />
        {errors.email && <p className="mt-1 text-sm text-destructive">{errors.email.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">Password</label>
        <input
          {...register('password')}
          type="password"
          className="mt-1 appearance-none block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
        />
        {errors.password && <p className="mt-1 text-sm text-destructive">{errors.password.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">Confirm Password</label>
        <input
          {...register('confirmPassword')}
          type="password"
          className="mt-1 appearance-none block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
        />
        {errors.confirmPassword && <p className="mt-1 text-sm text-destructive">{errors.confirmPassword.message}</p>}
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
        >
          {isLoading ? 'Registering...' : 'Create Account'}
        </button>
      </div>
    </form>
  );
}
