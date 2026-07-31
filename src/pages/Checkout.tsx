import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/authService';
import { formatPrice } from '../utils/currency';
import { 
  Lock, ArrowRight, ShieldCheck, Sparkles, CheckCircle2, 
  AlertCircle, Loader2, CreditCard, ChevronRight
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

  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [gstin, setGstin] = useState('');

  // Auth gate state (Login/Register tab)
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authFirstName, setAuthFirstName] = useState('');
  const [authLastName, setAuthLastName] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // General flow states
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<'details' | 'success'>('details');
  const [transactionId, setTransactionId] = useState('');
  const [gstError, setGstError] = useState<string | null>(null);
  const [sdkError, setSdkError] = useState<string | null>(null);

  // Pre-fill profile name if logged in
  useEffect(() => {
    if (profile) {
      setFullName(`${profile.first_name || ''} ${profile.last_name || ''}`.trim());
    }
  }, [profile]);

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
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 }
        });
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
      name: 'Lelam Subscriptions',
      description: `Lelam ${planId === 'pro' ? 'Bidder Pro' : 'Explorer'} plan (${billingCycle})`,
      image: '/favicon.svg',
      handler: function (response: any) {
        setIsProcessing(false);
        setStep('success');
        setTransactionId(response.razorpay_payment_id || `pay_${Date.now().toString().slice(-6)}`);
        
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

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <Link to="/pricing" className="text-sm font-semibold text-primary hover:underline">
            ← Return to Pricing
          </Link>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mt-2">
            Secure Checkout
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Complete your subscription to Lelam platform tools
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Form Area */}
          <div className="lg:col-span-7">
            {step === 'details' ? (
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
                {!isAuthenticated ? (
                  <div>
                    <div className="flex border-b border-slate-200 mb-6 bg-slate-50 p-1.5 rounded-xl">
                      <button
                        onClick={() => { setAuthTab('login'); setAuthError(null); }}
                        className={`flex-1 py-2.5 text-center font-bold text-sm rounded-lg transition-all ${
                          authTab === 'login' ? 'bg-white text-primary shadow-xs' : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        Sign In
                      </button>
                      <button
                        onClick={() => { setAuthTab('register'); setAuthError(null); }}
                        className={`flex-1 py-2.5 text-center font-bold text-sm rounded-lg transition-all ${
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
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">First Name</label>
                            <input
                              type="text"
                              required
                              value={authFirstName}
                              onChange={(e) => setAuthFirstName(e.target.value)}
                              className="w-full px-4 py-2.5 border border-slate-255 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Last Name</label>
                            <input
                              type="text"
                              required
                              value={authLastName}
                              onChange={(e) => setAuthLastName(e.target.value)}
                              className="w-full px-4 py-2.5 border border-slate-255 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none"
                            />
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email Address</label>
                        <input
                          type="email"
                          required
                          value={authEmail}
                          onChange={(e) => setAuthEmail(e.target.value)}
                          className="w-full px-4 py-2.5 border border-slate-255 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Password</label>
                        <input
                          type="password"
                          required
                          value={authPassword}
                          onChange={(e) => setAuthPassword(e.target.value)}
                          className="w-full px-4 py-2.5 border border-slate-255 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none"
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
                ) : (
                  <form onSubmit={handlePay} className="space-y-6">
                    {sdkError && (
                      <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl text-sm flex items-start gap-2.5">
                        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <span>{sdkError}</span>
                      </div>
                    )}

                    {/* Step 1: Billing details */}
                    <div>
                      <h3 className="text-base font-bold text-slate-800 border-b pb-2 mb-4">
                        1. Billing Information
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Full Name</label>
                          <input
                            type="text"
                            required
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className="w-full px-4 py-2.5 border border-slate-250 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Business Name (Optional)</label>
                          <input
                            type="text"
                            value={businessName}
                            onChange={(e) => setBusinessName(e.target.value)}
                            className="w-full px-4 py-2.5 border border-slate-250 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">GSTIN (Optional — for tax invoice claim)</label>
                          <input
                            type="text"
                            value={gstin}
                            onChange={(e) => setGstin(e.target.value)}
                            placeholder="e.g. 22AAAAA1111A1Z1"
                            className="w-full px-4 py-2.5 border border-slate-250 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none font-mono uppercase"
                          />
                          {gstError && <p className="text-red-500 text-xs font-bold mt-1">{gstError}</p>}
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Billing Address</label>
                          <textarea
                            required
                            value={billingAddress}
                            onChange={(e) => setBillingAddress(e.target.value)}
                            rows={3}
                            className="w-full px-4 py-2.5 border border-slate-250 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none resize-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Step 2: Payment Gateway Notification */}
                    {total > 0 && (
                      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex gap-3 text-left">
                        <CreditCard className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-xs font-bold text-slate-800">Secure Payment via Razorpay</h4>
                          <p className="text-[11px] text-slate-500 leading-normal mt-0.5">
                            Upon clicking proceed, the Razorpay window will open overlaying the page. You can pay via Cards, UPI, Net Banking, or Wallets securely.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Step 3: Action Button */}
                    <button
                      type="submit"
                      disabled={isProcessing}
                      className="w-full bg-primary text-white py-3 rounded-xl font-bold text-base hover:bg-primary/95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-md shadow-primary/20"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Launching Razorpay Checkout...
                        </>
                      ) : planId === 'pro' ? (
                        <span className="flex items-center gap-1.5">
                          Proceed to Payment <ChevronRight className="w-4 h-4" />
                        </span>
                      ) : (
                        'Activate Free Explorer Plan'
                      )}
                    </button>
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
                  <p className="text-sm text-slate-500 max-w-md mx-auto">
                    Your {planId === 'pro' ? 'Bidder Pro' : 'Explorer'} subscription has been successfully registered. You now have full access to platform tools.
                  </p>
                </div>

                {/* Simulated Invoice/Receipt details */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-left max-w-md mx-auto space-y-3 font-medium text-slate-700 text-xs">
                  <h3 className="text-xs font-black uppercase text-slate-400 border-b pb-1.5 mb-2">Invoice details</h3>
                  <div className="flex justify-between">
                    <span>Razorpay Payment ID</span>
                    <span className="font-mono font-bold text-slate-800">{transactionId}</span>
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

          {/* Right Summary Column */}
          <div className="lg:col-span-5 space-y-6">
            {/* Order summary card */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
              <h3 className="text-base font-bold text-slate-800 border-b pb-2">
                Order Summary
              </h3>

              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-sm font-bold text-slate-850 uppercase tracking-wide">
                      {planId === 'pro' ? 'Bidder Pro Plan' : 'Explorer Plan'}
                    </h4>
                    <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                      Billed {billingCycle}
                    </p>
                  </div>
                  <span className="text-sm font-extrabold text-slate-900 font-mono">
                    {formatPrice(subtotal)}
                  </span>
                </div>

                <hr className="border-slate-100" />

                {planId === 'pro' && (
                  <>
                    <div className="flex justify-between items-center text-xs font-semibold text-slate-500">
                      <span>GST (18%)</span>
                      <span className="font-mono">{formatPrice(gst)}</span>
                    </div>
                    <hr className="border-slate-100" />
                  </>
                )}

                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-800">Total Due</span>
                  <span className="text-lg font-black text-slate-950 font-mono">
                    {formatPrice(total)}
                  </span>
                </div>
              </div>

              {planId === 'pro' && (
                <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10">
                  <h4 className="text-xs font-bold text-primary flex items-center gap-1.5 mb-1.5">
                    <Sparkles className="w-3.5 h-3.5 fill-current" /> Pro Access Features
                  </h4>
                  <ul className="space-y-1 text-slate-655 text-[11px] font-semibold leading-normal list-disc list-inside text-slate-600">
                    <li>AI Valuation Engine (Profit & Loss)</li>
                    <li>ML Scrap Price Predictor</li>
                    <li>Live market rates & price history</li>
                    <li>Up to 3 team seats</li>
                    <li>Document vault for paperwork</li>
                  </ul>
                </div>
              )}
            </div>

            {/* Trust and safety details */}
            <div className="bg-slate-900 text-white rounded-3xl p-6 space-y-4 shadow-sm border border-slate-850">
              <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" /> Secure checkout guarantee
              </h3>
              <p className="text-[11px] text-slate-350 leading-relaxed font-medium">
                Your credentials and payment data are protected using end-to-end TLS 1.3 encryption. Lelam complies fully with payment industry compliance and security audits.
              </p>
              <div className="flex items-center gap-2 border-t border-slate-800 pt-3">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[10px] font-bold text-slate-400">SSL Encrypted / 256-Bit Cryptography</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
