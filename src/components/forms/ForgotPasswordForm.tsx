import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { authService } from '../../services/authService';
import { Mail, Loader2, KeyRound, ShieldCheck, ArrowLeft } from 'lucide-react';

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordForm() {
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  useEffect(() => {
    if (otpCooldown > 0) {
      const timer = setTimeout(() => setOtpCooldown(otpCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [otpCooldown]);

  const onSubmit = async (data: ForgotPasswordValues) => {
    setIsLoading(true);
    setAuthError(null);
    try {
      await authService.resetPasswordForEmail(data.email, `${window.location.origin}/auth/reset-password`);
      setSubmittedEmail(data.email);
      setEmailSubmitted(true);
      setOtpCooldown(60);
    } catch (error: any) {
      setAuthError(error.message || 'Failed to send reset email');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setCodeError(null);
    setAuthError(null);

    if (!otpCode) {
      setCodeError('Verification code is required');
      return;
    }
    if (otpCode.length !== 6) {
      setCodeError('Verification code must be 6 digits');
      return;
    }

    setIsLoading(true);
    try {
      const { session } = await authService.verifyRecoveryOtp(submittedEmail, otpCode);
      if (!session) {
        throw new Error('Verification failed. Invalid or expired code.');
      }
      
      // Successfully authenticated via recovery OTP, redirect to change password
      navigate('/auth/reset-password');
    } catch (error: any) {
      setAuthError(error.message || 'Failed to verify reset code');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {authError && (
        <div className="bg-destructive/10 border border-destructive/25 text-destructive px-4 py-3 rounded-xl text-sm">
          {authError}
        </div>
      )}

      {emailSubmitted ? (
        <div className="space-y-4 animate-fade-in">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3.5 text-xs text-blue-800 flex items-start gap-2.5">
            <Mail className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              We've sent a 6-digit password reset verification code to <span className="font-bold">{submittedEmail}</span>.
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">Verification Code</label>
            <div className="relative rounded-xl shadow-xs">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <KeyRound className="h-5 w-5" />
              </div>
              <input
                type="text"
                pattern="\d*"
                maxLength={6}
                value={otpCode}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  setOtpCode(val);
                  setCodeError(null);
                }}
                placeholder="123456"
                className="block w-full pl-11 pr-4 h-12 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white tracking-widest text-center font-bold text-lg sm:text-base transition-all duration-200"
              />
            </div>
            {codeError && <p className="mt-1 text-xs text-destructive font-medium">{codeError}</p>}
          </div>

          <div className="pt-2 space-y-3">
            <button
              type="button"
              onClick={handleVerifyOtp}
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
                  Verify Code
                  <ShieldCheck className="ml-2 h-5 w-5" />
                </>
              )}
            </button>

            <div className="flex justify-between items-center text-xs">
              <button
                type="button"
                onClick={() => {
                  setEmailSubmitted(false);
                  setOtpCode('');
                  setCodeError(null);
                  setAuthError(null);
                }}
                className="flex items-center text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                Change Email
              </button>

              <button
                type="button"
                disabled={otpCooldown > 0 || isLoading}
                onClick={() => onSubmit({ email: submittedEmail })}
                className="text-primary hover:text-primary-700 font-bold disabled:text-slate-400 transition-colors cursor-pointer"
              >
                {otpCooldown > 0 ? `Resend in ${otpCooldown}s` : 'Resend Code'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">Email address</label>
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

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-primary hover:bg-primary/95 hover:shadow-lg hover:shadow-primary/20 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all duration-200 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                  Sending code...
                </>
              ) : (
                'Send reset code'
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
