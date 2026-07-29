import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { authService } from '../../services/authService';
import { publicService } from '../../services/publicService';
import { Mail, Lock, Loader2, LogIn, Eye, EyeOff } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

async function getSecurityAttemptContext() {
  let ipAddress = 'Unknown';
  let geoData: any = {};

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const res = await fetch('https://ipapi.co/json/', { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      ipAddress = data.ip || 'Unknown';
      geoData = {
        city: data.city,
        region: data.region,
        country: data.country_name,
        countryCode: data.country_code,
        postal: data.postal,
        latitude: data.latitude,
        longitude: data.longitude,
        timezone: data.timezone,
        org: data.org,
        asn: data.asn
      };
    }
  } catch (_) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const res2 = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res2.ok) {
        const data2 = await res2.json();
        ipAddress = data2.ip || 'Unknown';
      }
    } catch (__) {}
  }

  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: {
      effectiveType?: string;
      downlink?: number;
      rtt?: number;
      saveData?: boolean;
    };
  };

  return {
    ipAddress,
    systemInfo: {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      screen: `${window.screen.width}x${window.screen.height}`,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      language: navigator.language,
      languages: navigator.languages,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      referrer: document.referrer || 'Direct',
      page: window.location.pathname,
      cookieEnabled: navigator.cookieEnabled,
      online: navigator.onLine,
      deviceMemory: nav.deviceMemory,
      hardwareConcurrency: navigator.hardwareConcurrency,
      maxTouchPoints: navigator.maxTouchPoints,
      colorDepth: window.screen.colorDepth,
      pixelRatio: window.devicePixelRatio,
      connection: nav.connection ? {
        effectiveType: nav.connection.effectiveType,
        downlink: nav.connection.downlink,
        rtt: nav.connection.rtt,
        saveData: nav.connection.saveData
      } : undefined,
      geo: geoData
    }
  };
}

export function LoginForm({ isAdminLogin = false }: { isAdminLogin?: boolean }) {
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { setSession } = useAuthStore();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setAuthError(null);
    try {
      await authService.signInWithOAuth('google');
    } catch (error: any) {
      setAuthError(error.message || 'Google sign in failed');
      setIsLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setIsLoading(true);
    setAuthError(null);
    try {
      await authService.signInWithOAuth('apple');
    } catch (error: any) {
      setAuthError(error.message || 'Apple sign in failed');
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    setAuthError(null);
    let didLogSecurityAttempt = false;
    try {
      const { session } = await authService.signIn(data.email, data.password);
      
      // Fetch profile to verify role
      const profile = await authService.getProfile(session.user.id);
      const isAuthorized = profile?.role === 'admin' || profile?.role === 'superadmin';

      if (isAdminLogin && !isAuthorized) {
        // Sign out immediately to avoid establishing session
        await authService.signOut();

        const { ipAddress, systemInfo } = await getSecurityAttemptContext();

        try {
          await publicService.logUnauthorizedLogin({
            email: data.email,
            user_id: session.user.id,
            ip_address: ipAddress,
            user_agent: navigator.userAgent,
            system_info: systemInfo
          });
          didLogSecurityAttempt = true;
        } catch (logErr) {
          console.error('Failed to log security audit:', logErr);
        }

        throw new Error('Access denied. Only administrators are allowed.');
      }

      setSession(session);
      useAuthStore.getState().setProfile(profile);
      
      if (isAuthorized) {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (error: any) {
      if (isAdminLogin && !didLogSecurityAttempt) {
        try {
          const { ipAddress, systemInfo } = await getSecurityAttemptContext();
          await publicService.logUnauthorizedLogin({
            email: data.email,
            ip_address: ipAddress,
            user_agent: navigator.userAgent,
            system_info: {
              ...systemInfo,
              failureReason: error.message || 'Sign in failed'
            }
          });
        } catch (logErr) {
          console.error('Failed to log security audit:', logErr);
        }
      }
      setAuthError(error.message || 'Failed to sign in');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-5">
      {authError && (
        <div className="bg-destructive/10 border border-destructive/25 text-destructive px-4 py-3 rounded-xl text-xs sm:text-sm font-medium animate-fade-in">
          {authError}
        </div>
      )}
      
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Email address</label>
        <div className="relative rounded-xl shadow-2xs">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Mail className="h-5 w-5" />
          </div>
          <input
            {...register('email')}
            type="email"
            placeholder="name@company.com"
            className="block w-full pl-11 pr-4 h-12 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white transition-all duration-200 text-base sm:text-sm"
          />
        </div>
        {errors.email && <p className="mt-1 text-xs text-destructive font-medium">{errors.email.message}</p>}
      </div>

      <div>
        <div className="flex justify-between items-center mb-1.5">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">Password</label>
          <button
            type="button"
            onClick={() => navigate('/auth/forgot-password')}
            className="text-xs font-semibold text-primary hover:text-primary-700 transition-colors cursor-pointer"
          >
            Forgot password?
          </button>
        </div>
        <div className="relative rounded-xl shadow-2xs">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Lock className="h-5 w-5" />
          </div>
          <input
            {...register('password')}
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            className="block w-full pl-11 pr-11 h-12 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white transition-all duration-200 text-base sm:text-sm"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
        {errors.password && <p className="mt-1 text-xs text-destructive font-medium">{errors.password.message}</p>}
      </div>

      <div className="flex items-center pt-1">
        <label htmlFor="remember-me" className="flex items-center cursor-pointer select-none group">
          <div className="relative flex items-center justify-center shrink-0">
            <input
              id="remember-me"
              name="remember-me"
              type="checkbox"
              className="peer h-5 w-5 rounded-md border-2 border-slate-300 text-primary bg-white focus:outline-none checked:bg-primary checked:border-primary appearance-none transition-all duration-200 shadow-2xs group-hover:border-primary/60 cursor-pointer"
            />
            <svg
              className="absolute h-3.5 w-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-200 pointer-events-none"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="3.5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <span className="ml-2.5 text-xs sm:text-sm font-medium text-slate-600 group-hover:text-slate-900 transition-colors">
            Keep me signed in for 30 days
          </span>
        </label>
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={isLoading}
          className="w-full h-12 flex justify-center items-center py-3 px-4 rounded-xl shadow-md text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 active:scale-[0.98] focus:outline-none focus:ring-4 focus:ring-primary/20 transition-all duration-200 cursor-pointer disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5" />
              Signing in...
            </>
          ) : (
            <>
              Sign in
              <LogIn className="ml-2 h-5 w-5" />
            </>
          )}
        </button>
      </div>

      {!isAdminLogin && (
        <>
          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink mx-4 text-slate-400 text-xs font-bold uppercase tracking-wider">Or continue with</span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={isLoading}
              onClick={handleGoogleSignIn}
              className="flex items-center justify-center gap-2 h-11 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all duration-200 cursor-pointer font-semibold text-slate-700 text-sm shadow-xs disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#EA4335" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.68 1.54 14.98 1 12 1 7.35 1 3.37 3.65 1.4 7.56l3.92 3.04C6.27 7.56 8.91 5.04 12 5.04z" />
                <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.46c-.29 1.48-1.14 2.73-2.42 3.57v2.96h3.91c2.28-2.1 3.54-5.18 3.54-8.68z" />
                <path fill="#FBBC05" d="M5.32 14.9a6.97 6.97 0 0 1 0-4.19L1.4 7.67a11.96 11.96 0 0 0 0 11.41l3.92-3.18z" />
                <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.92l-3.91-2.96c-1.12.75-2.55 1.19-4.05 1.19-3.09 0-5.73-2.52-6.68-5.56L1.4 15.79C3.37 19.7 7.35 23 12 23z" />
              </svg>
              Google
            </button>
            <button
              type="button"
              disabled={isLoading}
              onClick={handleAppleSignIn}
              className="flex items-center justify-center gap-2 h-11 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all duration-200 cursor-pointer font-semibold text-slate-700 text-sm shadow-xs disabled:opacity-50"
            >
              <svg className="w-5 h-5 fill-slate-900" viewBox="0 0 24 24">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.82M15.97 4.17c.66-.81 1.11-1.93.99-3.06-1 .04-2.21.67-2.93 1.49-.62.69-1.16 1.84-1.01 2.96 1.12.09 2.27-.58 2.95-1.39z" />
              </svg>
              Apple
            </button>
          </div>
        </>
      )}
    </form>
  );
}
