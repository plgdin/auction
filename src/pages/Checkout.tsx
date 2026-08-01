import { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/authService';
import { supabase } from '../lib/supabase';
import { formatPrice } from '../utils/currency';
import { 
  Lock, ArrowRight, CheckCircle2, AlertCircle, Loader2, 
  CreditCard, ChevronRight, User, Building2, Check, ChevronLeft,
  ShoppingBag, ChevronDown, Users, Plus, Minus, Sparkles
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { motion } from 'framer-motion';

// Primitives imports to match template specifications
import { Button } from '../components/ui/button';
import { Card, CardHeader, CardContent, CardFooter } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import { Skeleton } from '../components/ui/skeleton';

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

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
];

const isGibberish = (text: string): boolean => {
  const clean = text.trim().toLowerCase();
  if (clean.length < 4) return false;

  // Must contain at least 3 alphabetic letters (prevents numeric-only keysmash like "239048239048")
  const lettersOnly = clean.replace(/[^a-z]/g, '');
  if (lettersOnly.length < 3) return true;

  // All same char (e.g. "aaaaa", "11111")
  if (/^(.)\1+$/.test(clean)) return true;

  // Keyboard mash patterns (e.g. "asdf", "sdasdasd", "qwerty", "zxcv")
  if (/^(asdf|qwerty|zxcv|1234|sdas|dasd|fgdf|ghjh)+$/.test(clean)) return true;

  // Low vowel ratio for words without numbers (e.g. "sdasdasd", "bcdfghjkl")
  if (lettersOnly.length >= 5 && !/\d/.test(clean)) {
    const vowels = lettersOnly.match(/[aeiou]/g);
    if (!vowels || vowels.length / lettersOnly.length < 0.15) {
      return true;
    }
  }

  // Repeating short sequence (e.g. "dasdasd", "asdasd")
  if (/(.{2,4})\1{2,}/.test(clean)) return true;

  return false;
};

export function CheckoutPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, isAuthenticated, setSession, setProfile } = useAuthStore();

  // State for Billing cycle & details
  const planId = searchParams.get('plan') || 'pro';
  const billingCycle = searchParams.get('billing') || 'monthly';

  // Navigation steps: 1 = Account, 2 = Billing, 3 = Review
  const [currentStep, setCurrentStep] = useState<number>(1);

  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [isStateOpen, setIsStateOpen] = useState(false);
  const [stateSearch, setStateSearch] = useState('');
  const stateDropdownRef = useRef<HTMLDivElement>(null);
  const [pincode, setPincode] = useState('');
  const [isPincodeLoading, setIsPincodeLoading] = useState(false);
  const [pincodeError, setPincodeError] = useState<string | null>(null);
  const [gstin, setGstin] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [seats, setSeats] = useState<number>(1);

  // Close state dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (stateDropdownRef.current && !stateDropdownRef.current.contains(event.target as Node)) {
        setIsStateOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredStates = INDIAN_STATES.filter((st) =>
    st.toLowerCase().includes(stateName.toLowerCase())
  );

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

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isPageLoading && !isAuthenticated) {
      navigate('/auth/login?redirect=/pricing', { replace: true });
    }
  }, [isPageLoading, isAuthenticated, navigate]);

  // Pre-fill profile name if logged in
  useEffect(() => {
    if (profile) {
      setFullName(`${profile.first_name || ''} ${profile.last_name || ''}`.trim());
      // Auto advance to step 2 if already logged in on mount
      setCurrentStep(2);
    }
  }, [profile]);

  // Auto-fetch City and State from 6-digit Pincode
  const fetchPincodeDetails = async (pin: string) => {
    if (pin.length !== 6 || !/^\d{6}$/.test(pin)) return;
    setIsPincodeLoading(true);
    setPincodeError(null);
    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
      const data = await res.json();
      if (data && data[0] && data[0].Status === 'Success' && data[0].PostOffice?.length > 0) {
        const po = data[0].PostOffice[0];
        if (po.District) setCity(po.District);
        if (po.State) {
          const matchedState = INDIAN_STATES.find(s => s.toLowerCase() === po.State.toLowerCase()) || po.State;
          setStateName(matchedState);
        }
      } else {
        setPincodeError('Pincode not found. Please enter City & State manually.');
      }
    } catch (_) {
      // Ignore network errors, allow manual entry
    } finally {
      setIsPincodeLoading(false);
    }
  };

  // Sync formatted billing address for summary & receipt
  useEffect(() => {
    const parts = [addressLine1, addressLine2, city, stateName].filter(Boolean);
    const formatted = parts.length > 0 ? `${parts.join(', ')}${pincode ? ` - ${pincode}` : ''}` : '';
    setBillingAddress(formatted);
  }, [addressLine1, addressLine2, city, stateName, pincode]);

  // Adjust step dynamically if user logs in
  useEffect(() => {
    if (isAuthenticated && currentStep === 1) {
      setCurrentStep(2);
    }
  }, [isAuthenticated]);

  // Pricing calculations
  const baseSubtotal = 
    (planId === 'pro' || planId === 'premium') ? (billingCycle === 'annual' ? 15830 : 1499) :
    (planId === 'go-subscription' || planId === 'go') ? (billingCycle === 'annual' ? 8438 : 799) : 0;
  
  const seatUnitPrice = billingCycle === 'annual' ? 4990 : 499;
  const extraSeats = Math.max(0, seats - 1);
  const extraSeatsCost = (planId === 'pro' || planId === 'premium') ? extraSeats * seatUnitPrice : 0;
  const subtotal = baseSubtotal + extraSeatsCost;
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

    const rzpKey = import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_mockkey12345';
    const isMockMode = rzpKey === 'rzp_test_mockkey12345' || rzpKey.includes('mockkey');

    // If it's a free Explorer setup or using a dummy key, mock activation directly
    if (total === 0 || isMockMode) {
      setTimeout(() => {
        setIsProcessing(false);
        setStep('success');
        setTransactionId(total === 0 ? `FREE-${Date.now().toString().slice(-6)}` : `MOCK-PAY-${Date.now().toString().slice(-6)}`);
        if (user?.id) {
          authService.updateProfile(user.id, { subscription_plan: planId as any }).then((updated) => {
            if (updated) setProfile(updated);
          });
        }
        
        // Trigger celebratory confetti for paid plans
        if (planId !== 'explorer') {
          confetti({
            particleCount: 150,
            spread: 80,
            origin: { y: 0.6 }
          });
        }
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

    let orderId = '';
    let token = '';

    try {
      const { data } = await supabase.auth.getSession();
      token = data.session?.access_token || '';
      
      const orderResponse = await fetch('/api/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: total * 100, // paise
          currency: 'INR',
          receipt: `rcpt_${Date.now()}`
        })
      });

      const orderData = await orderResponse.json();
      if (!orderData.success) {
        setIsProcessing(false);
        setSdkError(orderData.error?.message || orderData.error || 'Failed to create payment order. Please try again.');
        return;
      }
      orderId = orderData.data.order_id;
    } catch (err) {
      setIsProcessing(false);
      setSdkError('Failed to connect to the billing backend. Please try again.');
      return;
    }

    // Configure Razorpay Checkout options
    const options = {
      key: rzpKey,
      amount: total * 100, // paise
      currency: 'INR',
      name: 'Lelam Company',
      description: `Lelam ${(planId === 'pro' || planId === 'premium') ? 'Bidder Pro' : (planId === 'go' || planId === 'go-subscription') ? 'Go Subscription' : 'Explorer'} plan (${billingCycle})`,
      image: '/favicon.svg',
      order_id: orderId,
      config: {
        display: {
          blocks: {
            banks: {
              name: 'Pay via Card, UPI or Net Banking',
              instruments: [
                { method: 'card' },
                { method: 'upi' },
                { method: 'netbanking' }
              ]
            }
          },
          sequence: ['block.banks'],
          preferences: {
            show_default_blocks: false
          }
        }
      },
      handler: async function (response: any) {
        setIsProcessing(true);
        try {
          const verifyResponse = await fetch('/api/verify-payment', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              order_id: response.razorpay_order_id,
              payment_id: response.razorpay_payment_id,
              signature: response.razorpay_signature
            })
          });

          const verifyData = await verifyResponse.json();
          if (!verifyData.success) {
            setIsProcessing(false);
            setSdkError(verifyData.error?.message || verifyData.error || 'Payment signature verification failed.');
            return;
          }

          setIsProcessing(false);
          setStep('success');
          setTransactionId(response.razorpay_payment_id);
          
          // Confetti only for paid plan subscriptions
          confetti({
            particleCount: 150,
            spread: 80,
            origin: { y: 0.6 }
          });

          if (user?.id) {
            authService.updateProfile(user.id, { subscription_plan: planId as any }).then((updated) => {
              if (updated) setProfile(updated);
            });
          }
        } catch (err) {
          setIsProcessing(false);
          setSdkError('An error occurred during payment verification. Please contact support.');
        }
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
      
      // Register event listener for failed payments as requested
      rzp.on('payment.failed', function (response: any) {
        setIsProcessing(false);
        setSdkError(`Payment failed: ${response.error.description} (Code: ${response.error.code})`);
      });
      
      rzp.open();
    } catch (err) {
      setIsProcessing(false);
      setSdkError('Could not initialize the payment gateway overlay. Please try again.');
    }
  };

  const isStateValid = INDIAN_STATES.some(
    (st) => st.toLowerCase() === stateName.trim().toLowerCase()
  );
  const isAddressValid = addressLine1.trim().length >= 5 && !isGibberish(addressLine1);
  const isCityValid = city.trim().length >= 2 && !isGibberish(city) && !/\d/.test(city);
  const isNameValid = fullName.trim().length >= 3 && !isGibberish(fullName) && !/\d/.test(fullName);
  const isPincodeValid = /^[1-9][0-9]{5}$/.test(pincode.trim());

  const validateStep = (stepNumber: number): boolean => {
    switch (stepNumber) {
      case 1:
        return isAuthenticated;
      case 2:
        return !!(isNameValid && isAddressValid && isCityValid && isStateValid && isPincodeValid);
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
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 flex flex-col gap-6">
            <Card>
              <CardContent className="p-6 md:p-8 space-y-6">
                <Skeleton className="h-6 w-48" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="space-y-2">
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="h-10 w-full rounded-xl" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="space-y-6">
            <Card className="h-64" />
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
                Checkout
              </h1>
              <p className="text-slate-500 text-sm">
                Complete your purchase securely
              </p>
            </div>
          </div>
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
              <div className="space-y-6">
                
                {/* STEP 1: Account Gate */}
                {currentStep === 1 && (
                  <Card className="flex flex-col gap-6">
                    <CardHeader>
                      <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 pb-2 border-b border-slate-100">
                        <User className="h-5 w-5 text-primary" />
                        Account Authentication
                      </h2>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4 text-left">
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
                            <div className="flex flex-col gap-2">
                              <Label htmlFor="authFirstName">First Name *</Label>
                              <Input
                                id="authFirstName"
                                type="text"
                                required
                                value={authFirstName}
                                onChange={(e) => setAuthFirstName(e.target.value)}
                              />
                            </div>
                            <div className="flex flex-col gap-2">
                              <Label htmlFor="authLastName">Last Name *</Label>
                              <Input
                                id="authLastName"
                                type="text"
                                required
                                value={authLastName}
                                onChange={(e) => setAuthLastName(e.target.value)}
                              />
                            </div>
                          </div>
                        )}

                        <div className="flex flex-col gap-2">
                          <Label htmlFor="authEmail">Email Address *</Label>
                          <Input
                            id="authEmail"
                            type="email"
                            required
                            value={authEmail}
                            onChange={(e) => setAuthEmail(e.target.value)}
                            leftIcon={<User className="h-4 w-4 text-slate-400" />}
                          />
                        </div>

                        <div className="flex flex-col gap-2">
                          <Label htmlFor="authPassword">Password *</Label>
                          <Input
                            id="authPassword"
                            type="password"
                            required
                            value={authPassword}
                            onChange={(e) => setAuthPassword(e.target.value)}
                            leftIcon={<Lock className="h-4 w-4 text-slate-400" />}
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
                    </CardContent>
                  </Card>
                )}

                {/* STEP 2: Billing details */}
                {currentStep === 2 && (
                  <Card className="flex flex-col gap-6">
                    <CardHeader>
                      <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 pb-2 border-b border-slate-100">
                        <Building2 className="h-5 w-5 text-primary" />
                        Billing Information
                      </h2>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4 text-left font-medium">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-2">
                          <Label htmlFor="fullName">Full Name *</Label>
                          <Input
                            id="fullName"
                            type="text"
                            required
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="John Doe"
                          />
                          {fullName.length > 2 && isGibberish(fullName) && (
                            <p className="text-red-500 text-xs font-bold mt-1">Please enter a valid full name.</p>
                          )}
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label htmlFor="businessName">Business Name (Optional)</Label>
                          <Input
                            id="businessName"
                            type="text"
                            value={businessName}
                            onChange={(e) => setBusinessName(e.target.value)}
                            placeholder="e.g. Acme Scrap Corp"
                          />
                        </div>
                        <div className="md:col-span-2 flex flex-col gap-2">
                          <Label htmlFor="gstin">GSTIN (Optional — for tax invoice claim)</Label>
                          <Input
                            id="gstin"
                            type="text"
                            value={gstin}
                            onChange={(e) => setGstin(e.target.value)}
                            placeholder="e.g. 22AAAAA1111A1Z1"
                            className="font-mono uppercase font-semibold"
                          />
                          {gstError && <p className="text-red-500 text-xs font-bold mt-1">{gstError}</p>}
                        </div>

                        {/* Pincode with Auto-Lookup */}
                        <div className="flex flex-col gap-2">
                          <div className="flex justify-between items-center">
                            <Label htmlFor="pincode">PIN Code *</Label>
                            {isPincodeLoading && (
                              <span className="text-[11px] text-primary font-semibold flex items-center gap-1">
                                <Loader2 className="w-3 h-3 animate-spin" /> Auto-fetching location...
                              </span>
                            )}
                          </div>
                          <Input
                            id="pincode"
                            type="text"
                            required
                            maxLength={6}
                            value={pincode}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                              setPincode(val);
                              if (val.length === 6) {
                                fetchPincodeDetails(val);
                              }
                            }}
                            placeholder="e.g. 400001"
                            className="font-mono font-bold tracking-wider"
                          />
                          {pincodeError && <p className="text-amber-600 text-xs font-medium mt-0.5">{pincodeError}</p>}
                        </div>

                        {/* City / District */}
                        <div className="flex flex-col gap-2">
                          <Label htmlFor="city">City / District *</Label>
                          <Input
                            id="city"
                            type="text"
                            required
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            placeholder="e.g. Mumbai"
                          />
                          {city.length > 1 && isGibberish(city) && (
                            <p className="text-red-500 text-xs font-bold mt-1">Please enter a valid city name.</p>
                          )}
                        </div>

                        {/* State Combobox Input */}
                        <div className="md:col-span-2 flex flex-col gap-2 relative" ref={stateDropdownRef}>
                          <Label htmlFor="stateName">State *</Label>
                          <div className="relative">
                            <Input
                              id="stateName"
                              type="text"
                              required
                              value={stateName}
                              onFocus={() => setIsStateOpen(true)}
                              onChange={(e) => {
                                setStateName(e.target.value);
                                setIsStateOpen(true);
                              }}
                              placeholder="Select State"
                              className="pr-10 font-semibold"
                            />
                            <button
                              type="button"
                              onClick={() => setIsStateOpen(!isStateOpen)}
                              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                            >
                              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isStateOpen ? 'rotate-180 text-primary' : ''}`} />
                            </button>
                          </div>
                          {stateName.length > 2 && !isStateValid && (
                            <p className="text-red-500 text-xs font-bold mt-1">Please select a valid Indian State from the dropdown.</p>
                          )}

                          {isStateOpen && (
                            <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 max-h-56 flex flex-col overflow-hidden animate-in fade-in-80 slide-in-from-top-2">
                              <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 scrollbar-thin">
                                {filteredStates.length > 0 ? (
                                  filteredStates.map((st) => (
                                    <button
                                      key={st}
                                      type="button"
                                      onMouseDown={(e) => {
                                        e.preventDefault();
                                        setStateName(st);
                                        setIsStateOpen(false);
                                      }}
                                      className={`w-full text-left px-3.5 py-2 text-xs sm:text-sm font-medium rounded-xl flex items-center justify-between transition-colors cursor-pointer ${
                                        stateName.toLowerCase() === st.toLowerCase()
                                          ? 'bg-primary/10 text-primary font-bold'
                                          : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                                      }`}
                                    >
                                      <span>{st}</span>
                                      {stateName.toLowerCase() === st.toLowerCase() && <Check className="w-4 h-4 text-primary shrink-0" />}
                                    </button>
                                  ))
                                ) : (
                                  <div className="px-3 py-4 text-xs text-center text-slate-400 font-medium">
                                    No matching state found
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Street Address Line 1 */}
                        <div className="md:col-span-2 flex flex-col gap-2">
                          <Label htmlFor="addressLine1">Flat / House No., Building, Street *</Label>
                          <Input
                            id="addressLine1"
                            type="text"
                            required
                            value={addressLine1}
                            onChange={(e) => setAddressLine1(e.target.value)}
                            placeholder="e.g. Flat 402, Sunshine Towers, MG Road"
                          />
                          {addressLine1.length > 2 && isGibberish(addressLine1) && (
                            <p className="text-red-500 text-xs font-bold mt-1">Please enter a valid street address (e.g. Flat 402, Sunshine Towers, MG Road).</p>
                          )}
                        </div>

                        {/* Street Address Line 2 */}
                        <div className="md:col-span-2 flex flex-col gap-2">
                          <Label htmlFor="addressLine2">Area / Locality / Landmark (Optional)</Label>
                          <Input
                            id="addressLine2"
                            type="text"
                            value={addressLine2}
                            onChange={(e) => setAddressLine2(e.target.value)}
                            placeholder="e.g. Near City Mall, Bandra West"
                          />
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="flex justify-between">
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={prevStep}
                        className="flex items-center gap-2"
                      >
                        <ChevronLeft className="h-4 w-4" /> Back
                      </Button>
                      <Button
                        onClick={nextStep}
                        disabled={!validateStep(2)}
                        size="lg"
                        className="flex items-center gap-2"
                      >
                        Continue to Review <ChevronRight className="h-4 w-4" />
                      </Button>
                    </CardFooter>
                  </Card>
                )}

                {/* STEP 3: Review and checkout */}
                {currentStep === 3 && (
                  <Card className="flex flex-col gap-6">
                    <CardHeader>
                      <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 pb-2 border-b border-slate-100">
                        <Check className="h-5 w-5 text-primary" />
                        Review & Confirm
                      </h2>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-6 text-left">
                      {sdkError && (
                        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl text-sm flex items-start gap-2.5">
                          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                          <span>{sdkError}</span>
                        </div>
                      )}

                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 text-xs text-slate-600 font-medium">
                          <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[10px] border-b border-slate-200/80 pb-2 flex items-center justify-between">
                            <span>Billing Identity</span>
                            <button
                              type="button"
                              onClick={() => setCurrentStep(2)}
                              className="text-primary hover:underline font-bold tracking-normal normal-case text-xs cursor-pointer"
                            >
                              Edit
                            </button>
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            <div>
                              <span className="text-slate-400 block text-[11px] font-semibold">Billing Name</span>
                              <span className="font-bold text-slate-900">{fullName}</span>
                            </div>
                            {businessName && (
                              <div>
                                <span className="text-slate-400 block text-[11px] font-semibold">Company Name</span>
                                <span className="font-bold text-slate-900">{businessName}</span>
                              </div>
                            )}
                            {gstin && (
                              <div>
                                <span className="text-slate-400 block text-[11px] font-semibold">GSTIN</span>
                                <span className="font-bold text-slate-900 font-mono">{gstin.toUpperCase()}</span>
                              </div>
                            )}
                            <div className="sm:col-span-2 border-t border-slate-200/60 pt-2">
                              <span className="text-slate-400 block text-[11px] font-semibold mb-0.5">Billing Address</span>
                              <span className="font-bold text-slate-800 leading-relaxed block">{billingAddress}</span>
                            </div>
                          </div>
                        </div>

                        {total > 0 && (
                          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex gap-3 text-left">
                            <CreditCard className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
                            <div>
                              <h4 className="text-xs font-bold text-slate-800">Secure Payment via Razorpay</h4>
                              <p className="text-[11px] text-slate-500 leading-normal mt-0.5">
                                Supported methods: Credit Card, Debit Card, UPI, & Net Banking. (EMI & Pay Later disabled).
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Terms check */}
                        <div className="flex items-start gap-3 border-t pt-4">
                          <Checkbox
                            id="agree-terms"
                            checked={agreeTerms}
                            onCheckedChange={(checked) => setAgreeTerms(checked)}
                            className="accent-blue-600 h-4.5 w-4.5 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                          <Label htmlFor="agree-terms" className="text-sm leading-relaxed cursor-pointer">
                            I agree to Lelam's{' '}
                            <Link to="/terms" target="_blank" className="text-blue-600 font-bold hover:underline">
                              Terms of Service
                            </Link>{' '}
                            and{' '}
                            <Link to="/faq" target="_blank" className="text-blue-600 font-bold hover:underline">
                              Refund & Cancellation Policy
                            </Link>
                            .
                          </Label>
                        </div>
                      </CardContent>
                    <CardFooter className="flex justify-between">
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={prevStep}
                        className="flex items-center gap-2"
                      >
                        <ChevronLeft className="h-4 w-4" /> Back
                      </Button>
                      <Button
                        onClick={handlePay}
                        disabled={isProcessing || !agreeTerms}
                        size="lg"
                        className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 flex items-center gap-2 text-white border-0 font-bold px-6 shadow-md shadow-emerald-600/20 disabled:opacity-50 cursor-pointer transition-all"
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
                      </Button>
                    </CardFooter>
                  </Card>
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
                    Your {(planId === 'pro' || planId === 'premium') ? 'Bidder Pro' : (planId === 'go' || planId === 'go-subscription') ? 'Go Subscription' : 'Explorer'} subscription has been successfully registered. You now have full access to platform tools.
                  </p>
                </div>

                {/* Receipt Details */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-left max-w-md mx-auto space-y-3 font-medium text-slate-700 text-xs">
                  <h3 className="text-xs font-black uppercase text-slate-400 border-b pb-1.5 mb-2">Invoice details</h3>
                  <div className="flex justify-between">
                    <span>Merchant</span>
                    <span className="font-bold text-slate-800">Lelam Company</span>
                  </div>
                  {gstin && (
                    <div className="flex justify-between">
                      <span>Customer GSTIN</span>
                      <span className="font-mono font-bold text-slate-900">{gstin.toUpperCase()}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Payment ID</span>
                    <span className="font-mono font-bold text-slate-800">{transactionId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Status</span>
                    <span className="font-bold text-emerald-600 uppercase">Paid / Success</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Activated Plan</span>
                    <span className="font-bold text-slate-800">
                      {(planId === 'pro' || planId === 'premium') ? 'Bidder Pro' : (planId === 'go' || planId === 'go-subscription') ? 'Go Subscription' : 'Explorer'} ({billingCycle})
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
            <div className="bg-white text-slate-900 rounded-3xl border border-slate-200 shadow-md p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <ShoppingBag className="h-4.5 w-4.5 text-primary" /> Order Summary
                </h3>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-primary bg-primary/10 px-2.5 py-1 rounded-full border border-primary/20">
                  {planId === 'pro' ? 'Pro Access' : 'Explorer'}
                </span>
              </div>

              <div className="space-y-4 text-left">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                      {planId === 'pro' ? 'Bidder Pro Plan' : 'Explorer Plan'}
                    </h4>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                      Billed {billingCycle}
                    </p>
                  </div>
                  <span className="text-base font-extrabold text-slate-900 font-mono">
                    {formatPrice(baseSubtotal)}
                  </span>
                </div>

                {planId === 'pro' && (
                  <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-xs font-bold text-slate-900 flex items-center gap-1.5 cursor-pointer">
                          <Users className="w-4 h-4 text-primary" /> Team Seats
                        </Label>
                        <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                          {seats === 1 ? '1 seat included' : `${seats} team seats included`}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
                        <button
                          type="button"
                          onClick={() => setSeats((prev) => Math.max(1, prev - 1))}
                          disabled={seats <= 1}
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-30 transition-colors font-bold text-sm cursor-pointer"
                          aria-label="Decrease seats"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-7 text-center font-bold text-xs text-slate-900 font-mono">
                          {seats}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSeats((prev) => Math.min(25, prev + 1))}
                          disabled={seats >= 25}
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-primary hover:bg-primary/95 text-white disabled:opacity-30 transition-colors font-bold text-sm cursor-pointer shadow-sm"
                          aria-label="Increase seats"
                        >
                          <Plus className="w-3.5 h-3.5 text-white" />
                        </button>
                      </div>
                    </div>

                    {extraSeats > 0 && (
                      <div className="flex justify-between items-center text-xs font-semibold text-slate-600 pt-2.5 border-t border-slate-200/60">
                        <span>
                          {extraSeats} Additional {extraSeats === 1 ? 'Seat' : 'Seats'} ({formatPrice(seatUnitPrice)}/{billingCycle === 'annual' ? 'yr' : 'mo'})
                        </span>
                        <span className="font-mono text-primary font-bold">{formatPrice(extraSeatsCost)}</span>
                      </div>
                    )}
                  </div>
                )}

                <hr className="border-slate-100" />

                {planId === 'pro' && (
                  <>
                    <div className="flex justify-between items-center text-xs font-medium text-slate-500">
                      <span>Subtotal</span>
                      <span className="font-mono text-slate-800 font-semibold">{formatPrice(subtotal)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-medium text-slate-500">
                      <span>GST (18%)</span>
                      <span className="font-mono text-slate-800 font-semibold">{formatPrice(gst)}</span>
                    </div>
                    <hr className="border-slate-100" />
                  </>
                )}

                <div className="flex justify-between items-center pt-1">
                  <span className="text-sm font-bold text-slate-900">Total Due</span>
                  <span className="text-2xl font-black text-emerald-600 font-mono tracking-tight">
                    {formatPrice(total)}
                  </span>
                </div>
              </div>

              {planId === 'pro' && (
                <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-2xl text-left space-y-3">
                  <h4 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-primary" /> Package Features Included
                  </h4>
                  <ul className="space-y-2.5 text-slate-600 text-xs font-medium leading-normal">
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span><strong className="text-slate-900 font-semibold">AI Valuation Engine</strong> — Profit & loss estimates</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span><strong className="text-slate-900 font-semibold">ML Scrap Price Predictor</strong> — Live price trends</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span><strong className="text-slate-900 font-semibold">Live Commodity Rates</strong> — Historical market prices</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span><strong className="text-slate-900 font-semibold">{seats} Team {seats === 1 ? 'Seat' : 'Seats'} Included</strong> — Shared bidding workspace</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span><strong className="text-slate-900 font-semibold">Document Vault & EMD</strong> — Paperwork & HSN tracking</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span><strong className="text-slate-900 font-semibold">Real-Time Auction Alerts</strong> — Instant WhatsApp & SMS</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span><strong className="text-slate-900 font-semibold">Priority 24/7 VIP Support</strong> — Tender assistance</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span><strong className="text-slate-900 font-semibold">Unlimited Catalog Downloads</strong> — MSTC & government PDFs</span>
                    </li>
                  </ul>
                </div>
              )}

              {/* Merchant Details */}
              <div className="border-t border-slate-100 pt-4 text-[10px] text-slate-400 space-y-1 leading-normal font-medium text-left">
                <p className="font-bold text-slate-800 text-xs">Lelam Company</p>
                <p className="text-slate-500 text-[11px]">Support: support@lelam.co | +91 94477 53889</p>
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

export default CheckoutPage;
