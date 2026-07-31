import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/authService';
import { formatPrice } from '../utils/currency';
import { 
  Lock, ArrowRight, CheckCircle2, AlertCircle, Loader2, 
  CreditCard, ChevronRight, User, Building2, Check, ChevronLeft,
  ShoppingBag
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { motion } from 'framer-motion';

// Dynamic script loader for Razorpay SDK
const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export function CheckoutPage() {
  const [searchParams] = useSearchParams();
  const { user, profile, isAuthenticated, setSession, setProfile } = useAuthStore();

  // State for Billing cycle & details
  const planId = searchParams.get('plan') || 'pro';
  const billingCycle = searchParams.get('billing') || 'monthly';

  // Navigation steps: 1 = Account, 2 = Billing, 3 = Review
  const [currentStep, setCurrentStep] = useState<number>(1);

  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [gstin, setGstin] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);

  // Auth gate state (Login/Register tab)
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authFirstName, setAuthFirstName] = useState('');
  const [authLastName, setAuthLastName] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // General flow states
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<'details' | 'success'>('details');
  const [transactionId, setTransactionId] = useState('');
  const [gstError, setGstError] = useState<string | null>(null);
  const [sdkError, setSdkError] = useState<string | null>(null);

  // Simulate initial loading block to match template skeleton
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsPageLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  // Pre-fill profile name if logged in
  useEffect(() => {
    if (profile) {
      setFullName(`${profile.first_name || ''} ${profile.last_name || ''}`.trim());
      // Auto advance to step 2 if already logged in on mount
      setCurrentStep(2);
    }
  }, [profile]);

  // Adjust step dynamically if user logs in
  useEffect(() => {
    if (isAuthenticated && currentStep === 1) {
      setCurrentStep(2);
    }
  }, [isAuthenticated]);

  // Pricing calculations
  const subtotal = planId === 'pro' ? (billingCycle === 'annual' ? 21110 : 1999) : 0;
  const gst = Math.round(subtotal * 0.18);
  const total = subtotal + gst;

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsAuthLoading(true);

    try {
      if (authTab === 'login') {
        const { session } = await authService.signIn(authEmail, authPassword);
        const profileData = await authService.getProfile(session.user.id);
        setSession(session);
        setProfile(profileData);
      } else {
        const data = await authService.signUp(authEmail, authPassword, authFirstName, authLastName);
        if (data.session) {
          setSession(data.session);
          const profileData = await authService.getProfile(data.user!.id);
          setProfile(profileData);
        } else {
          setAuthError('Verification email sent! Please check your inbox to activate your account.');
        }
      }
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    setGstError(null);
    setSdkError(null);

    // Validate GSTIN format if supplied
    if (gstin) {
      const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstRegex.test(gstin.toUpperCase())) {
        setGstError('Invalid GSTIN format. Correct format is like: 22AAAAA1111A1Z1');
        return;
      }
    }

    setIsProcessing(true);

    // If it's a free Explorer setup, skip payment gateways entirely
    if (total === 0) {
      setTimeout(() => {
        setIsProcessing(false);
        setStep('success');
        setTransactionId(`FREE-${Date.now().toString().slice(-6)}`);
      }, 1500);
      return;
    }

    // Load Razorpay Checkout SDK script
    const scriptLoaded = await loadRazorpayScript();
    if (!scriptLoaded) {
      setIsProcessing(false);
      setSdkError('Razorpay Payment Gateway failed to load. Please check your internet connection or adblocker.');
      return;
    }

    // Configure Razorpay Checkout options
    const options = {
      key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_mockkey12345',
      amount: total * 100, // paise
      currency: 'INR',
      name: 'Lelam Technologies',
      description: `Lelam ${planId === 'pro' ? 'Bidder Pro' : 'Explorer'} plan (${billingCycle})`,
      image: '/favicon.svg',
      handler: function (response: any) {
        setIsProcessing(false);
        setStep('success');
        setTransactionId(response.razorpay_payment_id || `pay_${Date.now().toString().slice(-6)}`);
        
        // Confetti only for paid plan subscriptions
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 }
        });
      },
      prefill: {
        name: fullName,
        email: user?.email || authEmail || '',
      },
      notes: {
        plan_id: planId,
        billing_cycle: billingCycle,
        gstin: gstin || 'None',
        business_name: businessName || 'None'
      },
      theme: {
        color: '#0284c7', // Brand primary blue color
      },
      modal: {
        ondismiss: () => {
          setIsProcessing(false);
        }
      }
    };

    try {
      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err) {
      setIsProcessing(false);
      setSdkError('Could not initialize the payment gateway overlay. Please try again.');
    }
  };

  const validateStep = (stepNumber: number): boolean => {
    switch (stepNumber) {
      case 1:
        return isAuthenticated;
      case 2:
        return !!(fullName.trim() && billingAddress.trim());
      case 3:
        return agreeTerms;
      default:
        return false;
    }
  };

  const nextStep = () => {
    if (currentStep === 1 && !isAuthenticated) {
      return;
    }
    if (currentStep === 2) {
      setGstError(null);
      if (gstin) {
        const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
        if (!gstRegex.test(gstin.toUpperCase())) {
          setGstError('Invalid GSTIN format. Correct format is like: 22AAAAA1111A1Z1');
          return;
        }
      }
    }
    setCurrentStep((prev) => Math.min(prev + 1, 3));
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  // Skeleton view to match template skeleton design
  if (isPageLoading) {
    return (
      <div className="w-full max-w-6xl mx-auto p-6 md:p-12 flex flex-col gap-6 animate-pulse">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="h-4 w-32 bg-slate-200 rounded" />
          <div className="h-6 w-24 bg-slate-200 rounded-full" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 flex flex-col gap-6">
            <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 space-y-6">
              <div className="h-6 w-48 bg-slate-200 rounded" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="space-y-2">
                    <div className="h-3 w-16 bg-slate-200 rounded" />
                    <div className="h-10 w-full bg-slate-200 rounded-xl" />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-6 border border-slate-200 h-64" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-200">
          <div className="flex items-start gap-3 flex-col">
            <Link to="/pricing" className="text-sm font-semibold text-primary hover:underline flex items-center gap-1">
              <ChevronLeft className="h-4 w-4" />
              Back to Pricing
            </Link>
            <div className="flex flex-col gap-1 text-left">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Secure Checkout
              </h1>
              <p className="text-slate-500 text-sm">
                Complete your subscription securely
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Lock className="h-3.5 w-3.5" />
            SSL Secured
          </span>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-start gap-4 sm:gap-6 py-4 mb-8 overflow-x-auto">
          {[
            { step: 1, label: "Account", icon: User },
            { step: 2, label: "Billing", icon: Building2 },
            { step: 3, label: "Review", icon: Check },
          ].map(({ step: sNum, label, icon: Icon }, index) => (
            <div key={sNum} className="flex items-center gap-2 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors font-bold text-sm ${
                    currentStep >= sNum
                      ? 'bg-primary border-primary text-white'
                      : 'border-slate-200 text-slate-400'
                  }`}
                >
                  {currentStep > sNum ? (
                    <Check className="h-4 w-4 stroke-[3]" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
                <span
                  className={`text-sm font-bold ${
                    currentStep >= sNum ? 'text-slate-900' : 'text-slate-400'
                  }`}
                >
                  {label}
                </span>
              </div>
              {index < 2 && (
                <div
                  className={`w-8 h-0.5 ${
                    currentStep > sNum ? 'bg-primary' : 'bg-slate-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Form Steps */}
          <div className="lg:col-span-7">
            {step === 'details' ? (
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
                
                {/* STEP 1: Account Gate */}
                {currentStep === 1 && (
                  <div className="space-y-6 text-left">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 pb-2 border-b border-slate-100">
                      <User className="h-5 w-5 text-primary" />
                      Account Authentication
                    </h2>

                    <div className="flex border-b border-slate-200 mb-6 bg-slate-50 p-1.5 rounded-xl">
                      <button
                        onClick={() => { setAuthTab('login'); setAuthError(null); }}
                        className={`flex-1 py-2.5 text-center font-bold text-sm rounded-lg transition-all cursor-pointer ${
                          authTab === 'login' ? 'bg-white text-primary shadow-xs' : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        Sign In
                      </button>
                      <button
                        onClick={() => { setAuthTab('register'); setAuthError(null); }}
                        className={`flex-1 py-2.5 text-center font-bold text-sm rounded-lg transition-all cursor-pointer ${
                          authTab === 'register' ? 'bg-white text-primary shadow-xs' : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        Create Account
                      </button>
                    </div>

                    <form onSubmit={handleAuthSubmit} className="space-y-4">
                      {authError && (
                        <div className={`p-4 rounded-xl border text-sm flex items-start gap-2.5 ${
                          authError.includes('Verification') 
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                            : 'bg-red-50 border-red-200 text-red-800'
                        }`}>
                          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                          <span>{authError}</span>
                        </div>
                      )}

                      {authTab === 'register' && (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="block text-xs font-bold text-slate-500 uppercase">First Name *</label>
                            <input
                              type="text"
                              required
                              value={authFirstName}
                              onChange={(e) => setAuthFirstName(e.target.value)}
                              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none font-medium"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-xs font-bold text-slate-500 uppercase">Last Name *</label>
                            <input
                              type="text"
                              required
                              value={authLastName}
                              onChange={(e) => setAuthLastName(e.target.value)}
                              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none font-medium"
                            />
                          </div>
                        </div>
                      )}

                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-slate-500 uppercase">Email Address *</label>
                        <input
                          type="email"
                          required
                          value={authEmail}
                          onChange={(e) => setAuthEmail(e.target.value)}
                          className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none font-medium"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-slate-500 uppercase">Password *</label>
                        <input
                          type="password"
                          required
                          value={authPassword}
                          onChange={(e) => setAuthPassword(e.target.value)}
                          className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none font-medium"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isAuthLoading}
                        className="w-full bg-primary text-white py-3 rounded-xl font-bold text-sm hover:bg-primary/95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-md shadow-primary/20"
                      >
                        {isAuthLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Please wait...
                          </>
                        ) : authTab === 'login' ? (
                          'Sign In to Continue'
                        ) : (
                          'Create Account & Continue'
                        )}
                      </button>
                    </form>
                  </div>
                )}

                {/* STEP 2: Billing details */}
                {currentStep === 2 && (
                  <div className="space-y-6 text-left">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 pb-2 border-b border-slate-100">
                      <Building2 className="h-5 w-5 text-primary" />
                      Billing Information
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-slate-500 uppercase">Full Name *</label>
                        <input
                          type="text"
                          required
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none font-medium"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-slate-500 uppercase">Business Name (Optional)</label>
                        <input
                          type="text"
                          value={businessName}
                          onChange={(e) => setBusinessName(e.target.value)}
                          className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none font-medium"
                        />
                      </div>
                      <div className="md:col-span-2 space-y-1">
                        <label className="block text-xs font-bold text-slate-500 uppercase">GSTIN (Optional — for tax invoice claim)</label>
                        <input
                          type="text"
                          value={gstin}
                          onChange={(e) => setGstin(e.target.value)}
                          placeholder="e.g. 22AAAAA1111A1Z1"
                          className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none font-mono uppercase font-semibold"
                        />
                        {gstError && <p className="text-red-500 text-xs font-bold mt-1">{gstError}</p>}
                      </div>
                      <div className="md:col-span-2 space-y-1">
                        <label className="block text-xs font-bold text-slate-500 uppercase">Billing Address *</label>
                        <textarea
                          required
                          value={billingAddress}
                          onChange={(e) => setBillingAddress(e.target.value)}
                          rows={3}
                          className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none resize-none font-medium"
                        />
                      </div>
                    </div>

                    <div className="flex justify-between pt-4 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={prevStep}
                        className="px-5 py-2.5 border border-slate-200 text-slate-700 font-bold rounded-xl text-sm hover:bg-slate-50 transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" /> Back
                      </button>
                      <button
                        type="button"
                        onClick={nextStep}
                        disabled={!validateStep(2)}
                        className="px-6 py-2.5 bg-primary text-white font-bold rounded-xl text-sm hover:bg-primary/95 transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                      >
                        Continue to Review <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 3: Review and checkout */}
                {currentStep === 3 && (
                  <form onSubmit={handlePay} className="space-y-6 text-left">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 pb-2 border-b border-slate-100">
                      <Check className="h-5 w-5 text-primary" />
                      Review & Confirm
                    </h2>

                    {sdkError && (
                      <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl text-sm flex items-start gap-2.5">
                        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <span>{sdkError}</span>
                      </div>
                    )}

                    <div className="space-y-4">
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5 text-xs text-slate-600 font-medium">
                        <h4 className="font-bold text-slate-800 uppercase tracking-wide text-[10px] border-b pb-1.5 mb-2">Billing Identity</h4>
                        <div className="flex justify-between">
                          <span>Billing Name</span>
                          <span className="font-bold text-slate-900">{fullName}</span>
                        </div>
                        {businessName && (
                          <div className="flex justify-between">
                            <span>Company Name</span>
                            <span className="font-bold text-slate-900">{businessName}</span>
                          </div>
                        )}
                        {gstin && (
                          <div className="flex justify-between">
                            <span>Your GSTIN</span>
                            <span className="font-bold text-slate-900 font-mono">{gstin.toUpperCase()}</span>
                          </div>
                        )}
                        <div className="flex justify-between border-t border-slate-200/50 pt-2 mt-1">
                          <span>Address</span>
                          <span className="font-bold text-slate-800 max-w-[240px] text-right truncate">{billingAddress}</span>
                        </div>
                      </div>

                      {total > 0 && (
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex gap-3 text-left">
                          <CreditCard className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
                          <div>
                            <h4 className="text-xs font-bold text-slate-800">Secure Payment via Razorpay</h4>
                            <p className="text-[11px] text-slate-500 leading-normal mt-0.5">
                              Upon clicking complete, the Razorpay window will overlay the page. You can pay via Cards, UPI, Net Banking, or Wallets securely.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Terms check */}
                      <div className="flex items-start gap-3 text-xs text-slate-600 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                        <input
                          type="checkbox"
                          id="agree-terms"
                          required
                          checked={agreeTerms}
                          onChange={(e) => setAgreeTerms(e.target.checked)}
                          className="w-4 h-4 text-primary border-slate-300 rounded focus:ring-primary/20 mt-0.5 cursor-pointer"
                        />
                        <label htmlFor="agree-terms" className="leading-snug select-none cursor-pointer font-medium text-slate-700">
                          I agree to Lelam's{' '}
                          <Link to="/terms" target="_blank" className="text-primary font-bold hover:underline">
                            Terms of Service
                          </Link>{' '}
                          and{' '}
                          <Link to="/faq" target="_blank" className="text-primary font-bold hover:underline">
                            Refund & Cancellation Policy
                          </Link>
                          .
                        </label>
                      </div>
                    </div>

                    <div className="flex justify-between pt-4 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={prevStep}
                        className="px-5 py-2.5 border border-slate-200 text-slate-700 font-bold rounded-xl text-sm hover:bg-slate-50 transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" /> Back
                      </button>
                      <button
                        type="submit"
                        disabled={isProcessing || !agreeTerms}
                        className="px-6 py-2.5 bg-primary text-white font-bold rounded-xl text-sm hover:bg-primary/95 transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-md shadow-primary/20"
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" /> Launches Gateway...
                          </>
                        ) : planId === 'pro' ? (
                          <>
                            <Lock className="w-4 h-4" /> Complete Payment {formatPrice(total)}
                          </>
                        ) : (
                          'Activate Free Plan'
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6 text-center"
              >
                <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
                </div>

                <div className="space-y-2">
                  <h2 className="text-2xl font-black text-slate-900">Subscription Activated!</h2>
                  <p className="text-sm text-slate-500 max-w-md mx-auto font-medium">
                    Your {planId === 'pro' ? 'Bidder Pro' : 'Explorer'} subscription has been successfully registered. You now have full access to platform tools.
                  </p>
                </div>

                {/* Receipt Details */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-left max-w-md mx-auto space-y-3 font-medium text-slate-700 text-xs">
                  <h3 className="text-xs font-black uppercase text-slate-400 border-b pb-1.5 mb-2">Invoice details</h3>
                  <div className="flex justify-between">
                    <span>Merchant</span>
                    <span className="font-bold text-slate-800">Lelam Technologies Private Limited</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Merchant GSTIN</span>
                    <span className="font-mono font-bold text-slate-900">27AADCL5842K1Z0</span>
                  </div>
                  {gstin && (
                    <div className="flex justify-between">
                      <span>Customer GSTIN</span>
                      <span className="font-mono font-bold text-slate-900">{gstin.toUpperCase()}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Payment ID</span>
                    <span className="font-mono font-bold text-slate-850">{transactionId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Status</span>
                    <span className="font-bold text-emerald-600 uppercase">Paid / Success</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Activated Plan</span>
                    <span className="font-bold text-slate-800">
                      {planId === 'pro' ? 'Bidder Pro' : 'Explorer'} ({billingCycle})
                    </span>
                  </div>
                  <div className="flex justify-between border-t pt-2 mt-1">
                    <span>Amount Charged</span>
                    <span className="font-bold text-slate-900 text-sm font-mono">{formatPrice(total)}</span>
                  </div>
                </div>

                <div className="pt-4 max-w-md mx-auto">
                  <Link
                    to="/dashboard"
                    className="w-full bg-primary text-white py-3 rounded-xl font-bold text-sm hover:bg-primary/95 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-primary/20"
                  >
                    Go to Dashboard <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </motion.div>
            )}
          </div>

          {/* Right Column: Order Summary Card */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-slate-900 text-white rounded-3xl border border-slate-800 shadow-xl p-6 space-y-6">
              <h3 className="text-base font-black text-white border-b border-slate-800 pb-2 flex items-center gap-2">
                <ShoppingBag className="h-4.5 w-4.5" /> Order Summary
              </h3>

              <div className="space-y-4 text-left">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-sm font-bold text-slate-200 uppercase tracking-wide">
                      {planId === 'pro' ? 'Bidder Pro Plan' : 'Explorer Plan'}
                    </h4>
                    <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                      Billed {billingCycle}
                    </p>
                  </div>
                  <span className="text-sm font-extrabold text-white font-mono">
                    {formatPrice(subtotal)}
                  </span>
                </div>

                <hr className="border-slate-800" />

                {planId === 'pro' && (
                  <>
                    <div className="flex justify-between items-center text-xs font-semibold text-slate-400">
                      <span>GST (18%)</span>
                      <span className="font-mono">{formatPrice(gst)}</span>
                    </div>
                    <hr className="border-slate-800" />
                  </>
                )}

                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-350">Total Due</span>
                  <span className="text-lg font-black text-emerald-400 font-mono">
                    {formatPrice(total)}
                  </span>
                </div>
              </div>

              {planId === 'pro' && (
                <div className="bg-slate-800/40 p-4 rounded-2xl border border-slate-800 text-left">
                  <h4 className="text-xs font-bold text-primary mb-1.5">
                    Pro Access Features
                  </h4>
                  <ul className="space-y-1 text-slate-300 text-[11px] font-semibold leading-normal list-disc list-inside">
                    <li>AI Valuation Engine (Profit & Loss)</li>
                    <li>ML Scrap Price Predictor</li>
                    <li>Live market rates & price history</li>
                    <li>Up to 3 team seats</li>
                    <li>Document vault for paperwork</li>
                  </ul>
                </div>
              )}

              {/* Merchant Details */}
              <div className="border-t border-slate-800/80 pt-4 text-[10px] text-slate-400 space-y-1 leading-normal font-medium text-left">
                <p className="font-bold text-slate-300">Lelam Technologies Private Limited</p>
                <p>Seller GSTIN: 27AADCL5842K1Z0</p>
                <p>Support: support@lelam.in | +91 22 6902 4500</p>
              </div>
            </div>

            {/* Trust and safety details */}
            <div className="text-center pt-2 px-4 space-y-1.5">
              <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1.5 font-bold">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                Payments processed securely by Razorpay
              </p>
              <p className="text-[10px] text-slate-400 leading-normal max-w-xs mx-auto font-medium">
                Lelam never views or stores your credit/debit card numbers or credentials.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
