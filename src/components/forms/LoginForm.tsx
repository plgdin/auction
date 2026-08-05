import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { authService } from '../../services/authService';
import { publicService } from '../../services/publicService';
import { Mail, Lock, Loader2, LogIn, Eye, EyeOff, KeyRound, ShieldCheck, ArrowLeft, Shield } from 'lucide-react';

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

  const googleBtnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let checkInterval: any;
    
    const initializeGoogleButton = () => {
      const google = (window as any).google;
      if (google && googleBtnRef.current) {
        clearInterval(checkInterval);
        try {
          google.accounts.id.initialize({
            client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '646836716775-qdcu7env4a6i8490odqktdhji4p8qk93.apps.googleusercontent.com',
            callback: async (response: any) => {
              setIsLoading(true);
              setAuthError(null);
              try {
                const { session } = await authService.signInWithIdToken(response.credential);
                const profile = await authService.getProfile(session.user.id);
                setSession(session);
                useAuthStore.getState().setProfile(profile);

                const searchParams = new URLSearchParams(window.location.search);
                const redirectParam = searchParams.get('redirect');

                if (profile?.role === 'admin' || profile?.role === 'superadmin') {
                  navigate('/admin', { replace: true });
                } else if (redirectParam) {
                  navigate(redirectParam, { replace: true });
                } else {
                  navigate('/dashboard', { replace: true });
                }
              } catch (error: any) {
                setAuthError(error.message || 'Google sign in failed');
                setIsLoading(false);
              }
            },
          });

          google.accounts.id.renderButton(googleBtnRef.current, {
            theme: 'outline',
            size: 'large',
            text: 'continue_with',
            shape: 'pill',
            logo_alignment: 'center',
            width: Math.min(googleBtnRef.current.parentElement?.clientWidth || 380, 380),
          });
        } catch (err) {
          console.error('Error initializing Google Sign-In:', err);
        }
      }
    };

    checkInterval = setInterval(initializeGoogleButton, 100);
    initializeGoogleButton();

    return () => {
      clearInterval(checkInterval);
    };
  }, []);

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    setAuthError(null);
    let didLogSecurityAttempt = false;
    try {
      const { user, session, mfaRequired } = await authService.signIn(data.email, data.password);
      
      if (mfaRequired) {
        setMfaEmail(data.email);
        setMfaActive(true);
        setOtpCooldown(60);
        return;
      }

      if (!session) {
        throw new Error('Sign in failed. No session established.');
      }
      
      // Fetch profile to verify role
      const profile = await authService.getProfile(user.id);
      const isAuthorized = profile?.role === 'admin' || profile?.role === 'superadmin';

      if (isAdminLogin && !isAuthorized) {
        // Sign out immediately to avoid establishing session
        await authService.signOut();

        const { ipAddress, systemInfo } = await getSecurityAttemptContext();

        try {
          await publicService.logUnauthorizedLogin({
            email: data.email,
            user_id: user.id,
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
      
      const searchParams = new URLSearchParams(window.location.search);
      const redirectParam = searchParams.get('redirect');

      if (isAuthorized) {
        navigate('/admin', { replace: true });
      } else if (redirectParam) {
        navigate(redirectParam, { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
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

  const [otpCooldown, setOtpCooldown] = useState(0);
  
  const [mfaActive, setMfaActive] = useState(false);
  const [mfaEmail, setMfaEmail] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaError, setMfaError] = useState<string | null>(null);

  useEffect(() => {
    if (otpCooldown > 0) {
      const timer = setTimeout(() => setOtpCooldown(otpCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [otpCooldown]);

  const handleVerifyMfa = async () => {
    setMfaError(null);
    setAuthError(null);

    if (!mfaCode) {
      setMfaError('Verification code is required');
      return;
    }
    if (mfaCode.length !== 6) {
      setMfaError('Verification code must be 6 digits');
      return;
    }

    setIsLoading(true);
    let didLogSecurityAttempt = false;
    try {
      const { session } = await authService.verifyOtp(mfaEmail, mfaCode);
      if (!session) {
        throw new Error('Verification failed. Invalid or expired code.');
      }

      // Fetch profile to verify role
      const profile = await authService.getProfile(session.user.id);
      const isAuthorized = profile?.role === 'admin' || profile?.role === 'superadmin';

      if (isAdminLogin && !isAuthorized) {
        await authService.signOut();

        const { ipAddress, systemInfo } = await getSecurityAttemptContext();

        try {
          await publicService.logUnauthorizedLogin({
            email: mfaEmail,
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

      const searchParams = new URLSearchParams(window.location.search);
      const redirectParam = searchParams.get('redirect');

      if (isAuthorized) {
        navigate('/admin', { replace: true });
      } else if (redirectParam) {
        navigate(redirectParam, { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (error: any) {
      if (isAdminLogin && !didLogSecurityAttempt) {
        try {
          const { ipAddress, systemInfo } = await getSecurityAttemptContext();
          await publicService.logUnauthorizedLogin({
            email: mfaEmail,
            ip_address: ipAddress,
            user_agent: navigator.userAgent,
            system_info: {
              ...systemInfo,
              failureReason: error.message || 'MFA verification failed'
            }
          });
        } catch (logErr) {
          console.error('Failed to log security audit:', logErr);
        }
      }
      setMfaError(error.message || 'Failed to verify MFA code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendMfa = async () => {
    setIsLoading(true);
    setMfaError(null);
    try {
      await authService.signInWithOtp(mfaEmail);
      setOtpCooldown(60);
    } catch (err: any) {
      setMfaError(err.message || 'Failed to resend code');
    } finally {
      setIsLoading(false);
    }
  };



  return (
    <div className="space-y-5">
      {authError && (
        <div className="bg-destructive/10 border border-destructive/25 text-destructive px-4 py-3 rounded-xl text-xs sm:text-sm font-medium animate-fade-in">
          {authError}
        </div>
      )}

      {mfaActive ? (
        <div className="space-y-4 animate-fade-in">
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3.5 text-xs text-amber-800 flex items-start gap-2.5">
            <Shield className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              Two-Factor Authentication is enabled. Please enter the 6-digit verification code sent to <span className="font-bold">{mfaEmail}</span>.
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Verification Code</label>
            <div className="relative rounded-xl shadow-2xs">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <KeyRound className="h-5 w-5" />
              </div>
              <input
                type="text"
                pattern="\d*"
                maxLength={6}
                value={mfaCode}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  setMfaCode(val);
                  setMfaError(null);
                }}
                placeholder="123456"
                className="block w-full pl-11 pr-4 h-12 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white tracking-widest text-center font-bold text-lg sm:text-base transition-all duration-200"
              />
            </div>
            {mfaError && <p className="mt-1 text-xs text-destructive font-medium">{mfaError}</p>}
          </div>

          <div className="pt-2 space-y-3">
            <button
              type="button"
              onClick={handleVerifyMfa}
              disabled={isLoading}
              className="w-full h-12 flex justify-center items-center py-3 px-4 rounded-xl shadow-md text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 active:scale-[0.98] focus:outline-none focus:ring-4 focus:ring-primary/20 transition-all duration-200 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5" />
                  Verifying...
                </>
              ) : (
                <>
                  Verify & Log In
                  <ShieldCheck className="ml-2 h-5 w-5" />
                </>
              )}
            </button>

            <div className="flex justify-between items-center text-xs">
              <button
                type="button"
                onClick={() => {
                  setMfaActive(false);
                  setMfaCode('');
                  setMfaError(null);
                  setAuthError(null);
                }}
                className="flex items-center text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                Back to Login
              </button>

              <button
                type="button"
                disabled={otpCooldown > 0 || isLoading}
                onClick={handleResendMfa}
                className="text-primary hover:text-primary-700 font-bold disabled:text-slate-400 transition-colors cursor-pointer"
              >
                {otpCooldown > 0 ? `Resend in ${otpCooldown}s` : 'Resend Code'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-5">
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
        </form>
      )}

      {!isAdminLogin && !mfaActive && (
        <>
          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink mx-4 text-slate-400 text-xs font-bold uppercase tracking-wider">Or continue with</span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          <div className="flex justify-center items-center w-full min-h-[44px]">
            <div ref={googleBtnRef} className="w-full flex justify-center items-center [&>div]:!mx-auto [&>iframe]:!mx-auto"></div>
          </div>
        </>
      )}
    </div>
  );
}
