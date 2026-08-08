import { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/authService';
import { supabase } from '../lib/supabase';
import { formatPrice } from '../utils/currency';
import { 
  Lock, ArrowRight, CheckCircle2, AlertCircle, Loader2, 
  CreditCard, ChevronRight, User, Building2, Check, ChevronLeft,
  ShoppingBag, ChevronDown, Users, Plus, Minus, Sparkles, XCircle, RotateCcw, HelpCircle, Printer, Shield, Download
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'framer-motion';
import { setTrialStartTimestamp } from '../utils/subscriptionUtils';

// Primitives imports to match template specifications
import { Button } from '../components/ui/button';
import { Card, CardHeader, CardContent, CardFooter } from '../components/ui/card';
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

const loadHtml2PdfScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if ((window as any).html2pdf) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
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
  const stateDropdownRef = useRef<HTMLDivElement>(null);
  const [pincode, setPincode] = useState('');
  const [isPincodeLoading, setIsPincodeLoading] = useState(false);
  const [pincodeError, setPincodeError] = useState<string | null>(null);
  const [gstin, setGstin] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [seats, setSeats] = useState<number>(1);
  const [isPdfDownloading, setIsPdfDownloading] = useState(false);

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
  const [step, setStep] = useState<'details' | 'verifying' | 'success' | 'failed'>('details');
  const [failureReason, setFailureReason] = useState<string>('');
  const [transactionId, setTransactionId] = useState('');
  const [gstError, setGstError] = useState<string | null>(null);
  const [sdkError, setSdkError] = useState<string | null>(null);

  // Check URL params for direct status preview
  useEffect(() => {
    const statusParam = searchParams.get('status');
    if (statusParam === 'failed') {
      setStep('failed');
      setFailureReason(searchParams.get('reason') || 'Payment declined by issuer or cancelled.');
      setTransactionId(searchParams.get('txn') || `FAIL-${Date.now().toString().slice(-6)}`);
    } else if (statusParam === 'success') {
      setStep('success');
      setTransactionId(searchParams.get('txn') || `SUCCESS-${Date.now().toString().slice(-6)}`);
    }
  }, [searchParams]);

  // Coupon Code States
  const [couponCode, setCouponCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<number>(0);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponSuccess, setCouponSuccess] = useState<string | null>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [appliedCouponCode, setAppliedCouponCode] = useState<string | null>(null);

  const handleApplyCoupon = async () => {
    setCouponError(null);
    setCouponSuccess(null);
    const code = couponCode.trim().toUpperCase();
    if (!code) return;

    setIsApplyingCoupon(true);

    try {
      const { data, error } = await supabase
        .from('promo_codes')
        .select('*')
        .eq('code', code)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        setCouponError('Invalid coupon code.');
        setAppliedDiscount(0);
        return;
      }

      const discountRate = (data.discount_percent || 0) / 100;
      setAppliedDiscount(discountRate);
      setAppliedCouponCode(code);
      setCouponSuccess(`Coupon ${code} applied! ${data.discount_percent}% discount has been applied.`);

      // Trigger festive confetti pop animation on successful discount application
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch (err) {
      setCouponError('Invalid coupon code.');
      setAppliedDiscount(0);
    } finally {
      setIsApplyingCoupon(false);
    }
  };

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
      const redirectPath = `/checkout${window.location.search}`;
      navigate(`/auth/login?redirect=${encodeURIComponent(redirectPath)}`, { replace: true });
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
    if (isAuthenticated && currentStep < 2) {
      setCurrentStep(2);
    }
  }, [isAuthenticated, currentStep]);

  // Pricing calculations
  const getPlanName = (id: string) => {
    const cleanId = id.toLowerCase();
    if (cleanId === 'pro' || cleanId === 'premium') return 'Business';
    if (cleanId === 'go' || cleanId === 'go-subscription') return 'Individual';
    return 'Free';
  };

  const isExplorerFree = planId === 'explorer' || planId === 'starter' || planId === 'free';
  const isTrial = (planId === 'pro' || planId === 'premium') && (searchParams.get('trial') !== 'false');
  const isFreeActivation = isExplorerFree || isTrial;

  const baseSubtotal = isFreeActivation 
    ? 0 
    : (planId === 'go' || planId === 'go-subscription')
      ? (billingCycle === 'annual' ? 8438 : 799)
      : (billingCycle === 'annual' ? 15830 : 1499);

  const seatUnitPrice = billingCycle === 'annual' ? 4990 : 499;
  const extraSeats = Math.max(0, seats - 1);
  const extraSeatsCost = isFreeActivation ? 0 : extraSeats * seatUnitPrice;
  const subtotalBeforeDiscount = baseSubtotal + extraSeatsCost;
  const discountAmount = Math.round(subtotalBeforeDiscount * appliedDiscount);
  const subtotal = subtotalBeforeDiscount - discountAmount;
  const gst = Math.round(subtotal * 0.18);
  const total = subtotal + gst;

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsAuthLoading(true);

    try {
      if (authTab === 'login') {
        const { session } = await authService.signIn(authEmail, authPassword);
        if (!session) throw new Error("Failed to start session.");
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

    const rzpKey = (import.meta.env.VITE_RAZORPAY_KEY_ID || (import.meta.env as any).RAZORPAY_KEY_ID || 'rzp_test_mockkey12345').trim();
    const isMockMode = rzpKey === 'rzp_test_mockkey12345' || rzpKey.includes('mockkey');

    // If it's a free Explorer/Individual setup, 7-day trial, or using a dummy key, mock activation directly
    if (total === 0 || isFreeActivation || isMockMode) {
      setTimeout(() => {
        setIsProcessing(false);
        setStep('success');
        setTransactionId(
          isTrial 
            ? `TRIAL-7D-${Date.now().toString().slice(-6)}`
            : `FREE-${Date.now().toString().slice(-6)}`
        );
        if (isTrial) {
          setTrialStartTimestamp(user?.id);
        }
        if (user?.id) {
          const planToSet = (planId === 'pro' || planId === 'premium') ? 'pro' : (planId === 'go' || planId === 'go-subscription') ? 'go' : 'explorer';
          const durationDays = isTrial ? 7 : (billingCycle === 'annual' ? 365 : 30);
          const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

          authService.updateProfile(user.id, { 
            subscription_plan: planToSet as any,
            subscription_expires_at: expiresAt
          }).then((updated) => {
            if (updated) setProfile(updated);
          });
        }
        
        // Trigger celebratory confetti for trial / free plans
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 }
        });

        import('../services/auditService').then(({ logUserActivity }) => {
          logUserActivity('checkout_success_free_or_trial', 'payment', planId, {
            planId,
            billingCycle,
            seats,
            isTrial,
            couponApplied: appliedDiscount > 0 ? couponCode : undefined,
            discountPct: appliedDiscount > 0 ? appliedDiscount * 100 : undefined
          });
        }).catch(() => {});
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
          receipt: `rcpt_${Date.now()}`,
          planId,
          billingCycle,
          extraSeats,
          couponCode: appliedDiscount > 0 ? appliedCouponCode : undefined
        })
      });

      const orderData = await orderResponse.json();
      if (!orderData.success) {
        setIsProcessing(false);
        const errStr = orderData.error?.message || orderData.error || 'Failed to create payment order. Please try again.';
        setSdkError(errStr);
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
      image: window.location.protocol === 'https:' ? '/favicon.svg' : undefined,
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
        // Immediately show verifying screen — blocks user from interacting
        setStep('verifying');
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

          // Brief delay so user sees the verification animation
          await new Promise(r => setTimeout(r, 1800));

          if (!verifyData.success) {
            setIsProcessing(false);
            const errStr = verifyData.error?.message || verifyData.error || 'Payment signature verification failed.';
            setSdkError(errStr);
            setFailureReason(errStr);
            setTransactionId(response.razorpay_payment_id || `FAIL-${Date.now().toString().slice(-6)}`);
            setStep('failed');
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
            const durationDays = billingCycle === 'annual' ? 365 : 30;
            const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
            authService.updateProfile(user.id, { 
              subscription_plan: planId as any,
              subscription_expires_at: expiresAt
            }).then((updated) => {
              if (updated) setProfile(updated);
            });
          }

          import('../services/auditService').then(({ logUserActivity }) => {
            logUserActivity('checkout_success_razorpay', 'payment', planId, {
              planId,
              billingCycle,
              seats,
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              couponApplied: appliedDiscount > 0 ? couponCode : undefined,
              discountPct: appliedDiscount > 0 ? appliedDiscount * 100 : undefined
            });
          }).catch(() => {});
        } catch (err) {
          setIsProcessing(false);
          const errStr = 'An error occurred during payment verification. Please contact support.';
          setSdkError(errStr);
          setFailureReason(errStr);
          setTransactionId(`ERR-${Date.now().toString().slice(-6)}`);
          setStep('failed');
          
          import('../services/auditService').then(({ logUserActivity }) => {
            logUserActivity('checkout_verification_error', 'payment', planId, {
              error: err instanceof Error ? err.message : String(err)
            });
          }).catch(() => {});
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
        const failDesc = response.error?.description || 'Transaction declined by payment gateway or issuing bank.';
        setSdkError(`Payment failed: ${failDesc} (Code: ${response.error?.code || 'DECLINED'})`);
        setFailureReason(failDesc);
        setTransactionId(response.error?.metadata?.payment_id || `FAIL-${Date.now().toString().slice(-6)}`);
        setStep('failed');

        import('../services/auditService').then(({ logUserActivity }) => {
          logUserActivity('checkout_payment_failed', 'payment', planId, {
            errorDescription: response.error?.description,
            errorCode: response.error?.code
          });
        }).catch(() => {});
      });
      
      rzp.open();
    } catch (err) {
      setIsProcessing(false);
      setFailureReason('Payment gateway initialization failed. Your test keys in .env.local may be inactive or expired on Razorpay.');
      setStep('failed');
    }
  };

  const generateInvoiceHTML = (): string => {
    const receiptNo = `REC-${transactionId.slice(-8) || '20260805'}`;
    const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const cgstAmount = Math.round(gst / 2);
    const sgstAmount = Math.round(gst / 2);
    const fmt = (n: number) => `\u20B9${n.toLocaleString('en-IN')}`;

    return `
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  
  .invoice-download-root {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: #1e293b;
    background: #ffffff;
    padding: 40px 50px;
    font-size: 13px;
    line-height: 1.5;
    width: 800px;
    box-sizing: border-box;
  }
  .invoice-download-root * { box-sizing: border-box; margin: 0; padding: 0; }
  
  /* Company Header Styling */
  .invoice-download-root .company h1 { font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; margin-bottom: 4px; }
  .invoice-download-root .company .tagline { color: #475569; font-size: 11px; font-weight: 600; margin-bottom: 8px; }
  .invoice-download-root .company .address { line-height: 1.6; color: #64748b; font-size: 11px; }
  
  /* Right Side Meta Info Styling */
  .invoice-download-root .receipt-title { font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }
  .invoice-download-root .meta-right p { font-size: 12px; color: #334155; margin: 4px 0; }
  .invoice-download-root .mono { font-family: 'Courier New', monospace; font-weight: 700; color: #0f172a; }
  .invoice-download-root .status { color: #059669; font-weight: 800; font-size: 12px; text-transform: uppercase; }
  
  /* Section Headers */
  .invoice-download-root .section-header { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-top: 20px; margin-bottom: 8px; }
  .invoice-download-root .billed-name { font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 4px; }
  .invoice-download-root .billed-details { font-size: 12px; color: #475569; line-height: 1.6; }
  .invoice-download-root .payment-details p { font-size: 12px; color: #475569; margin: 3px 0; }
  
  /* Items Table Styling */
  .invoice-download-root table.items-table { width: 100%; border-collapse: collapse; margin-top: 24px; margin-bottom: 24px; }
  .invoice-download-root table.items-table th { padding: 12px 6px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; color: #64748b; border-top: 1.5px solid #0f172a; border-bottom: 1.5px solid #0f172a; text-align: left; }
  .invoice-download-root table.items-table th.center { text-align: center; }
  .invoice-download-root table.items-table th.right { text-align: right; }
  .invoice-download-root table.items-table td { padding: 16px 6px; font-size: 12px; border-bottom: 1.5px solid #e2e8f0; color: #334155; vertical-align: top; }
  .invoice-download-root table.items-table td.center { text-align: center; }
  .invoice-download-root table.items-table td.right { text-align: right; font-family: 'Courier New', monospace; font-weight: 700; }
  .invoice-download-root .item-title { font-weight: 700; color: #0f172a; font-size: 13px; }
  .invoice-download-root .item-subtitle { font-size: 10px; color: #64748b; margin-top: 4px; }
  
  /* Totals Section Styling */
  .invoice-download-root .totals-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
  .invoice-download-root .totals-row { font-size: 12px; color: #475569; }
  .invoice-download-root .totals-row td { padding: 5px 0; }
  .invoice-download-root .totals-row td.val { font-family: 'Courier New', monospace; font-weight: 600; color: #334155; text-align: right; }
  .invoice-download-root .totals-row.grand { font-size: 14px; font-weight: 800; color: #0f172a; border-top: 1.5px solid #0f172a; border-bottom: 1.5px solid #0f172a; }
  .invoice-download-root .totals-row.grand td { padding: 10px 0; }
  .invoice-download-root .totals-row.grand td.val { color: #0f172a; font-size: 14px; }
  
  /* Footer Styling */
  .invoice-download-root .footer-table { width: 100%; border-collapse: collapse; border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 20px; }
  .invoice-download-root .terms h4 { font-size: 11px; font-weight: 700; color: #334155; margin-bottom: 6px; }
  .invoice-download-root .terms p { font-size: 10px; color: #64748b; margin: 3px 0; line-height: 1.6; }
  .invoice-download-root .terms a { color: #0284c7; font-weight: 700; text-decoration: underline; }
  .invoice-download-root .auth .company-name { font-weight: 900; font-size: 11px; text-transform: uppercase; color: #0f172a; }
  .invoice-download-root .auth .note { font-size: 9px; color: #94a3b8; font-style: italic; margin-top: 4px; }
</style>

<div class="invoice-download-root">
  <div class="page">
    <!-- Header Table -->
    <table style="width: 100%; border-collapse: collapse; border-bottom: 1.5px solid #0f172a; margin-bottom: 20px;">
      <tr>
        <td style="width: 60%; vertical-align: top; padding-bottom: 20px;">
          <div class="company">
            <img src="/png_lelam_1.webp" alt="Lelam Company" style="height: 38px; display: block; margin-bottom: 8px;" />
            <div class="tagline">India's Premier B2B Auction & Asset Platform</div>
            <div class="address">No: 2, 20th Cross Lakshmipuram, Halasuru, Bangalore 560008<br>Support: support@lelam.co | +91 94477 53889</div>
          </div>
        </td>
        <td style="width: 40%; text-align: right; vertical-align: top; padding-bottom: 20px;">
          <div class="receipt-title">Payment Receipt</div>
          <div class="meta-right">
            <p><strong>Receipt No:</strong> <span class="mono">${receiptNo}</span></p>
            <p>Date: ${dateStr}</p>
            <p class="status">\u2713 STATUS: PAID (SUCCESSFUL)</p>
          </div>
        </td>
      </tr>
    </table>
    
    <div class="body">
      <!-- Billed To Stacked Section -->
      <div class="section-header">Billed To (Customer)</div>
      <div class="billed-details" style="margin-bottom: 16px;">
        <p class="billed-name">${fullName || profile?.first_name || 'Valued Customer'}</p>
        <p>${billingAddress || addressLine1 || 'Registered Platform User'}</p>
        ${user?.email ? `<p>Email: ${user.email}</p>` : ''}
        ${gstin ? `<p class="mono" style="margin-top: 4px; font-size: 11px;">Customer GSTIN: ${gstin.toUpperCase()}</p>` : ''}
      </div>
      
      <!-- Payment Details Stacked Section -->
      <div class="section-header">Payment Details</div>
      <div class="payment-details" style="margin-bottom: 24px;">
        <p><strong>Payment ID:</strong> <span class="mono">${transactionId}</span></p>
        <p><strong>Payment Gateway:</strong> Razorpay Secure Gateway</p>
        <p><strong>Billing Cycle:</strong> ${billingCycle === 'annual' ? 'Annual (Yearly)' : 'Monthly'}</p>
        <p><strong>Subscription Plan:</strong> ${getPlanName(planId)} Plan</p>
      </div>
      
      <!-- Items Table -->
      <table class="items-table">
        <thead>
          <tr>
            <th style="width: 5%">#</th>
            <th style="width: 50%">Item Description</th>
            <th class="center" style="width: 15%">Cycle</th>
            <th class="center" style="width: 10%">Seats</th>
            <th class="right" style="width: 20%">Amount (INR)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="font-weight: 700; color: #94a3b8;">1</td>
            <td>
              <div class="item-title">Lelam ${getPlanName(planId)} Subscription Plan</div>
              <div class="item-subtitle">Full access to MSTC auctions, document vault, valuation engine & bidding tools</div>
            </td>
            <td class="center" style="text-transform: uppercase; font-weight: 500;">${billingCycle}</td>
            <td class="center" style="font-weight: 700;">${seats}</td>
            <td class="right">${fmt(baseSubtotal)}</td>
          </tr>
          ${extraSeats > 0 ? `
          <tr>
            <td style="font-weight: 700; color: #94a3b8;">2</td>
            <td>
              <div class="item-title">Additional Team Member Seats (${extraSeats})</div>
              <div class="item-subtitle">${extraSeats} extra seats \u00D7 ${fmt(seatUnitPrice)}/${billingCycle === 'annual' ? 'yr' : 'mo'}</div>
            </td>
            <td class="center" style="text-transform: uppercase; font-weight: 500;">${billingCycle}</td>
            <td class="center" style="font-weight: 700;">${extraSeats}</td>
            <td class="right">${fmt(extraSeatsCost)}</td>
          </tr>` : ''}
        </tbody>
      </table>
      
      <!-- Totals Section -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <tr>
          <td style="width: 60%;"></td>
          <td style="width: 40%;">
            <table class="totals-table">
              <tr class="totals-row">
                <td>Subtotal</td>
                <td class="val">${fmt(subtotalBeforeDiscount)}</td>
              </tr>
              ${discountAmount > 0 ? `
              <tr class="totals-row" style="color: #059669; font-weight: 600;">
                <td>Discount (${appliedDiscount * 100}% Off)</td>
                <td class="val" style="color: #059669; font-weight: 700;">- ${fmt(discountAmount)}</td>
              </tr>` : ''}
              <tr class="totals-row">
                <td>CGST (9%)</td>
                <td class="val">${fmt(cgstAmount)}</td>
              </tr>
              <tr class="totals-row">
                <td>SGST (9%)</td>
                <td class="val">${fmt(sgstAmount)}</td>
              </tr>
              <tr class="totals-row grand">
                <td>Total Amount Paid</td>
                <td class="val">${fmt(total)}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      
      <!-- Footer -->
      <table class="footer-table">
        <tr>
          <td style="width: 60%; vertical-align: bottom; padding-top: 20px;">
            <div class="terms">
              <h4>Terms & Conditions Apply:</h4>
              <p>1. All subscription payments are final and subject to Lelam platform policies.</p>
              <p>2. For complete Terms & Conditions, please visit: <a href="https://lelam.co/terms">https://lelam.co/terms</a></p>
              <p>3. For billing or account inquiries, contact <a href="mailto:support@lelam.co">support@lelam.co</a>.</p>
            </div>
          </td>
          <td style="width: 40%; text-align: right; vertical-align: bottom; padding-top: 20px;">
            <div class="auth">
              <p class="company-name">LELAM COMPANY</p>
              <p class="note">Authorized computer-generated receipt.</p>
            </div>
          </td>
        </tr>
      </table>
    </div>
  </div>
</div>
`;
  };

  const handleDownloadInvoice = async () => {
    setIsPdfDownloading(true);
    const scriptLoaded = await loadHtml2PdfScript();
    if (!scriptLoaded) {
      setIsPdfDownloading(false);
      alert('Failed to load PDF generation engine. Please check your network connection.');
      return;
    }

    try {
      const htmlContent = generateInvoiceHTML();
      
      // Inject standard sandboxed wrapping containers.
      // We pass the inner relative element to html2pdf, preventing absolute coordinate displacement.
      const outerContainer = document.createElement('div');
      outerContainer.id = 'lelam-invoice-pdf-outer-root';
      outerContainer.style.position = 'fixed';
      outerContainer.style.left = '0';
      outerContainer.style.top = '0';
      outerContainer.style.width = '800px';
      outerContainer.style.opacity = '0';
      outerContainer.style.zIndex = '-9999';
      outerContainer.style.pointerEvents = 'none';

      const innerContainer = document.createElement('div');
      innerContainer.innerHTML = htmlContent;
      outerContainer.appendChild(innerContainer);
      
      document.body.appendChild(outerContainer);

      // Give browser rendering threads time to parse the CSS layout and styles fully
      await new Promise((resolve) => setTimeout(resolve, 400));

      const opt = {
        margin:       0,
        filename:     `Lelam-Invoice-${transactionId || 'receipt'}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2.5, useCORS: true, letterRendering: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      await (window as any).html2pdf().set(opt).from(innerContainer).save();
      document.body.removeChild(outerContainer);
    } catch (err) {
      console.error('Failed to generate PDF invoice:', err);
      alert('An error occurred while generating your PDF invoice. Please try again.');
    } finally {
      setIsPdfDownloading(false);
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
    if (isAuthenticated) {
      setCurrentStep((prev) => Math.max(prev - 1, 2));
    } else {
      setCurrentStep((prev) => Math.max(prev - 1, 1));
    }
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
    <div className="min-h-screen bg-slate-50 py-6 sm:py-12 px-3 sm:px-6 lg:px-8">
      {/* Print stylesheet for clean official tax invoice printing */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-official-invoice, #printable-official-invoice * {
            visibility: visible !important;
          }
          #printable-official-invoice {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            box-shadow: none !important;
            border: none !important;
            background: #ffffff !important;
            padding: 2.5rem !important;
          }
        }
      `}</style>

      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8 pb-4 border-b border-slate-200">
          <div className="flex items-start gap-2 flex-col">
            <Link to="/pricing" className="text-xs sm:text-sm font-semibold text-primary hover:underline flex items-center gap-1 min-h-[36px]">
              <ChevronLeft className="h-4 w-4" />
              Back to Pricing
            </Link>
            <div className="flex flex-col gap-0.5 text-left">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Checkout
              </h1>
              <p className="text-slate-500 text-xs sm:text-sm">
                Complete your purchase securely
              </p>
            </div>
          </div>
        </div>

        {/* Progress Steps — only shown during checkout details form */}
        {step === 'details' && (
          <div className="flex items-center justify-between sm:justify-start gap-3 sm:gap-6 py-3 mb-6 sm:mb-8 overflow-x-auto no-scrollbar scroll-smooth">
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
                    className={`text-xs sm:text-sm font-bold ${
                      currentStep >= sNum ? 'text-slate-900' : 'text-slate-400'
                    }`}
                  >
                    {label}
                  </span>
                </div>
                {index < 2 && (
                  <div
                    className={`w-6 sm:w-8 h-0.5 ${
                      currentStep > sNum ? 'bg-primary' : 'bg-slate-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Form Steps */}
          <div className={step !== 'details' && step !== 'verifying' ? 'lg:col-span-12' : step === 'verifying' ? 'lg:col-span-12' : 'lg:col-span-7'}>
            {step === 'verifying' ? (
              /* VERIFYING PAYMENT — FULL SECURE LOADER */
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white rounded-3xl border border-slate-200 shadow-lg p-8 sm:p-14 text-center space-y-8 max-w-lg mx-auto select-none"
                style={{ pointerEvents: 'none' }}
              >
                {/* Pulsing shield icon */}
                <div className="relative w-24 h-24 mx-auto">
                  <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" />
                  <div className="relative w-24 h-24 bg-gradient-to-br from-primary to-primary/80 rounded-full flex items-center justify-center shadow-xl shadow-primary/20">
                    <Lock className="w-10 h-10 text-white stroke-[2.5]" />
                  </div>
                </div>

                <div className="space-y-3">
                  <h2 className="text-2xl sm:text-3xl font-black text-slate-900">Verifying Payment</h2>
                  <p className="text-sm text-slate-500 font-medium max-w-sm mx-auto">
                    Securely validating your transaction with the payment gateway. Please do not close or refresh this page.
                  </p>
                </div>

                {/* Animated progress bar */}
                <div className="max-w-xs mx-auto">
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-primary via-emerald-500 to-primary rounded-full"
                      initial={{ width: '0%' }}
                      animate={{ width: '100%' }}
                      transition={{ duration: 3, ease: 'easeInOut' }}
                    />
                  </div>
                </div>

                {/* Security badges */}
                <div className="flex items-center justify-center gap-4 text-xs text-slate-400 font-medium">
                  <span className="flex items-center gap-1"><Shield className="w-3.5 h-3.5" /> 256-bit SSL</span>
                  <span className="flex items-center gap-1"><Lock className="w-3.5 h-3.5" /> PCI-DSS Compliant</span>
                  <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Razorpay Verified</span>
                </div>
              </motion.div>
            ) : step === 'details' ? (
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
                    <CardFooter className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-between w-full pt-4 border-t">
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={prevStep}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 min-h-[44px]"
                      >
                        <ChevronLeft className="h-4 w-4" /> Back
                      </Button>
                      <Button
                        onClick={nextStep}
                        disabled={!validateStep(2)}
                        size="lg"
                        className="w-full sm:w-auto flex items-center justify-center gap-2 min-h-[44px]"
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
                        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-200">
                          <div className="flex items-center gap-2.5">
                            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                            <span className="font-medium text-rose-900">{sdkError}</span>
                          </div>
                          <Link
                            to={`/contact?issue=payment_failed&message=${encodeURIComponent(`Payment error: ${sdkError}`)}`}
                            className="text-xs font-bold text-rose-700 hover:text-rose-900 underline shrink-0 whitespace-nowrap bg-white py-1.5 px-3 rounded-lg border border-rose-200 shadow-2xs hover:bg-rose-50 transition-colors"
                          >
                            Contact Support →
                          </Link>
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
                            <Link to="/terms" target="_blank" className="text-blue-600 font-bold hover:underline">
                              Refund & Cancellation Policy
                            </Link>
                            .
                          </Label>
                        </div>
                      </CardContent>
                    <CardFooter className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-between w-full pt-4 border-t">
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={prevStep}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 min-h-[44px]"
                      >
                        <ChevronLeft className="h-4 w-4" /> Back
                      </Button>
                      <Button
                        onClick={handlePay}
                        disabled={isProcessing || !agreeTerms}
                        size="lg"
                        className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 flex items-center justify-center gap-2 text-white border-0 font-bold px-6 shadow-md shadow-emerald-600/20 disabled:opacity-50 cursor-pointer transition-all min-h-[44px]"
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" /> Activating...
                          </>
                        ) : isTrial ? (
                          <>
                            <Sparkles className="w-4 h-4" /> Start 7-Day Free Trial
                          </>
                        ) : total === 0 ? (
                          'Activate Free Plan'
                        ) : (
                          <>
                            <Lock className="w-4 h-4" /> Complete Payment {formatPrice(total)}
                          </>
                        )}
                      </Button>
                    </CardFooter>
                  </Card>
                )}
              </div>
            ) : step === 'success' ? (
              <>
                {/* OFFICIAL TAX INVOICE PRINT TEMPLATE (PRINT ONLY) */}
                <div id="printable-official-invoice" className="hidden print:block text-slate-900 bg-white p-8 max-w-3xl mx-auto font-sans leading-relaxed text-xs">
                  {/* Invoice Header */}
                  <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-6">
                    <div>
                      <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                        LELAM COMPANY
                      </h1>
                      <p className="text-slate-600 text-xs font-medium mt-0.5">India's Premier B2B Auction & Asset Platform</p>
                      <p className="text-slate-500 text-[11px] mt-1 leading-normal">
                        No: 2, 20th Cross Lakshmipuram, Halasuru, Bangalore 560008<br />
                        Support: support@lelam.co | +91 94477 53889
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="inline-block bg-slate-900 text-white px-3 py-1 font-extrabold text-xs uppercase tracking-widest rounded mb-2">
                        Payment Receipt
                      </div>
                      <p className="text-xs font-bold text-slate-800">Receipt No: <span className="font-mono text-slate-900">REC-{transactionId.slice(-8) || '20260805'}</span></p>
                      <p className="text-slate-500 text-xs mt-0.5">Date: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                      <p className="text-emerald-700 font-extrabold text-xs uppercase mt-1">Status: PAID (SUCCESSFUL)</p>
                    </div>
                  </div>

                  {/* Customer & Payment Info Grid */}
                  <div className="grid grid-cols-2 gap-6 bg-slate-50 border border-slate-200 p-5 rounded-xl mb-6 text-xs">
                    <div>
                      <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2">Billed To (Customer)</h3>
                      <p className="font-bold text-slate-900 text-sm">{fullName || profile?.first_name || 'Valued Customer'}</p>
                      {businessName && <p className="text-slate-700 font-semibold">{businessName}</p>}
                      <p className="text-slate-600 text-xs mt-0.5">{billingAddress || addressLine1 || 'Registered Platform User'}</p>
                      {user?.email && <p className="text-slate-500 text-xs mt-0.5">Email: {user.email}</p>}
                      {gstin && <p className="text-slate-900 font-mono font-bold text-xs mt-1">Customer GSTIN: {gstin.toUpperCase()}</p>}
                    </div>
                    <div>
                      <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2">Payment Details</h3>
                      <p className="text-slate-700 py-0.5"><strong>Payment ID:</strong> <span className="font-mono font-bold text-slate-900">{transactionId}</span></p>
                      <p className="text-slate-700 py-0.5"><strong>Payment Gateway:</strong> Razorpay Secure Gateway</p>
                      <p className="text-slate-700 py-0.5"><strong>Billing Cycle:</strong> {billingCycle === 'annual' ? 'Annual (Yearly)' : 'Monthly'}</p>
                      <p className="text-slate-700 py-0.5"><strong>Subscription Plan:</strong> {getPlanName(planId)} Plan</p>
                    </div>
                  </div>

                  {/* Particulars Table */}
                  <table className="w-full text-left border-collapse mb-6">
                    <thead>
                      <tr className="bg-slate-900 text-white text-[11px] uppercase tracking-wider font-bold">
                        <th className="py-2.5 px-3 rounded-l">#</th>
                        <th className="py-2.5 px-3">Item Description</th>
                        <th className="py-2.5 px-3 text-center">Cycle</th>
                        <th className="py-2.5 px-3 text-center">Seats</th>
                        <th className="py-2.5 px-3 text-right rounded-r">Amount (INR)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs">
                      <tr>
                        <td className="py-3 px-3 font-bold text-slate-500">1</td>
                        <td className="py-3 px-3">
                          <p className="font-bold text-slate-900">Lelam {getPlanName(planId)} Subscription Plan</p>
                          <p className="text-slate-500 text-[11px]">Full access to MSTC auctions, document vault, valuation engine & bidding tools</p>
                        </td>
                        <td className="py-3 px-3 text-center font-medium uppercase">{billingCycle}</td>
                        <td className="py-3 px-3 text-center font-bold">{seats}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold">{formatPrice(baseSubtotal)}</td>
                      </tr>
                      {extraSeats > 0 && (
                        <tr>
                          <td className="py-3 px-3 font-bold text-slate-500">2</td>
                          <td className="py-3 px-3">
                            <p className="font-bold text-slate-900">Additional Team Member Seats ({extraSeats})</p>
                            <p className="text-slate-500 text-[11px]">{extraSeats} extra seats included</p>
                          </td>
                          <td className="py-3 px-3 text-center font-medium uppercase">{billingCycle}</td>
                          <td className="py-3 px-3 text-center font-bold">{extraSeats}</td>
                          <td className="py-3 px-3 text-right font-mono font-bold">{formatPrice(extraSeatsCost)}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  {/* Total Calculations */}
                  <div className="flex justify-end mb-8">
                    <div className="w-64 space-y-2 text-xs">
                      <div className="flex justify-between text-slate-600">
                        <span>Subtotal</span>
                        <span className="font-mono font-semibold">{formatPrice(subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>CGST (9%)</span>
                        <span className="font-mono font-semibold">{formatPrice(Math.round(gst / 2))}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>SGST (9%)</span>
                        <span className="font-mono font-semibold">{formatPrice(Math.round(gst / 2))}</span>
                      </div>
                      <div className="flex justify-between text-sm font-black border-t-2 border-slate-900 pt-2 text-slate-900">
                        <span>Total Amount Paid</span>
                        <span className="font-mono">{formatPrice(total)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Terms & Authorization */}
                  <div className="border-t border-slate-200 pt-4 text-[10px] text-slate-500 flex justify-between items-end">
                    <div>
                      <p className="font-bold text-slate-700 text-xs mb-1">Terms & Conditions Apply:</p>
                      <p className="text-slate-600">1. All subscription payments are final and subject to Lelam platform policies.</p>
                      <p className="text-slate-600">
                        2. For complete Terms & Conditions, please visit:{' '}
                        <a href="https://lelam.co/terms" target="_blank" rel="noreferrer" className="text-primary font-bold underline">
                          https://lelam.co/terms
                        </a>
                      </p>
                      <p className="text-slate-600">3. For billing or account inquiries, contact <a href="mailto:support@lelam.co" className="text-primary font-bold underline">support@lelam.co</a>.</p>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <p className="font-bold text-slate-900 uppercase">Lelam Company</p>
                      <p className="text-[9px] text-slate-400 italic">Authorized computer-generated receipt.</p>
                    </div>
                  </div>
                </div>

                {/* WEB SCREEN SUCCESS CARD */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-10 space-y-6 text-center"
                >
                  <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
                  </div>

                  <div className="space-y-2">
                    <h2 className="text-2xl sm:text-3xl font-black text-slate-900">Subscription Activated!</h2>
                    <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto font-medium">
                      Your {getPlanName(planId)} subscription has been successfully registered. You now have full access to platform tools.
                    </p>
                  </div>

                  {/* Receipt Details Card */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-6 text-left max-w-md mx-auto space-y-3 font-medium text-slate-700 text-xs sm:text-sm">
                    <h3 className="text-xs font-black uppercase text-slate-400 border-b pb-2 mb-3 tracking-wider">Invoice details</h3>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-slate-500">Merchant</span>
                      <span className="font-bold text-slate-900">Lelam Company</span>
                    </div>
                    {gstin && (
                      <div className="flex justify-between items-center py-1">
                        <span className="text-slate-500">Customer GSTIN</span>
                        <span className="font-mono font-bold text-slate-900">{gstin.toUpperCase()}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center py-1">
                      <span className="text-slate-500">Payment ID</span>
                      <span className="font-mono font-bold text-slate-900">{transactionId}</span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-slate-500">Status</span>
                      <span className="font-bold text-emerald-600 uppercase">Paid / Success</span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-slate-500">Activated Plan</span>
                      <span className="font-bold text-slate-900">
                        {getPlanName(planId)} Plan ({billingCycle})
                      </span>
                    </div>
                    <div className="flex justify-between items-center border-t border-slate-200/80 pt-3 mt-2">
                      <span className="font-bold text-slate-900">Amount Charged</span>
                      <span className="font-extrabold text-slate-900 text-base font-mono">{formatPrice(total)}</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 font-medium">
                    Terms & Conditions apply. For full details, please review our{' '}
                    <Link to="/terms" target="_blank" className="text-primary font-bold hover:underline">
                      Terms of Service
                    </Link>.
                  </p>

                  <div className="pt-2 max-w-md mx-auto space-y-3">
                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        type="button"
                        onClick={handleDownloadInvoice}
                        disabled={isPdfDownloading}
                        className="flex-1 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 py-3 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs min-h-[44px] disabled:opacity-50"
                      >
                        {isPdfDownloading ? (
                          <>
                            <Loader2 className="w-4 h-4 text-slate-600 animate-spin" /> Generating PDF...
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4 text-slate-600" /> Download PDF Invoice
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="flex-1 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 py-3 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs min-h-[44px]"
                      >
                        <Printer className="w-4 h-4 text-slate-600" /> Print Invoice
                      </button>
                    </div>
                    <Link
                      to="/dashboard"
                      className="w-full bg-primary text-white py-3 px-4 rounded-xl font-bold text-sm hover:bg-primary/95 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-primary/20 min-h-[44px]"
                    >
                      Go to Dashboard <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </motion.div>
              </>
            ) : (
              /* FAILED STATE CARD */
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-3xl border border-rose-200 shadow-lg p-6 sm:p-10 space-y-6 text-center"
              >
                <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto border border-rose-100">
                  <XCircle className="w-10 h-10 stroke-[2]" />
                </div>

                <div className="space-y-2">
                  <h2 className="text-2xl font-black text-slate-900">Payment Unsuccessful</h2>
                  <p className="text-sm text-slate-600 max-w-md mx-auto font-medium">
                    We could not process your transaction. If money was debited from your account, our support team is available to help resolve or refund it immediately.
                  </p>
                </div>

                {/* Important Help Alert Box */}
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-left max-w-md mx-auto space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-amber-900 text-xs sm:text-sm">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Was money deducted from your bank or card?</span>
                  </div>
                  <p className="text-xs text-amber-800 leading-relaxed font-medium">
                    Please do not submit a duplicate payment if funds were debited. Contact support with your transaction reference for fast 24-hour verification or refund.
                  </p>
                </div>

                {/* Failed Transaction Info */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-left max-w-md mx-auto space-y-3 font-medium text-slate-700 text-xs">
                  <h3 className="text-xs font-black uppercase text-slate-400 border-b pb-1.5 mb-2">Attempt Details</h3>
                  <div className="flex justify-between">
                    <span>Target Plan</span>
                    <span className="font-bold text-slate-900">
                      {getPlanName(planId)} Plan ({billingCycle})
                    </span>
                  </div>
                  {transactionId && (
                    <div className="flex justify-between">
                      <span>Transaction Ref</span>
                      <span className="font-mono font-bold text-slate-900">{transactionId}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Status</span>
                    <span className="font-bold text-rose-600 uppercase">Failed / Action Required</span>
                  </div>
                  {failureReason && (
                    <div className="flex justify-between gap-4">
                      <span>Reason</span>
                      <span className="font-medium text-rose-700 text-right">{failureReason}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-2 mt-1">
                    <span>Amount Attempted</span>
                    <span className="font-bold text-slate-900 text-sm font-mono">{formatPrice(total)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-2 max-w-md mx-auto flex flex-col sm:flex-row gap-3">
                  <Link
                    to={`/contact?issue=payment_failed&txn_id=${encodeURIComponent(transactionId || 'UNKNOWN')}`}
                    className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-3 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-rose-600/20"
                  >
                    <HelpCircle className="w-4 h-4" /> Contact Support
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setStep('details');
                      setSdkError(null);
                    }}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 py-3 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer border border-slate-300 font-semibold"
                  >
                    <RotateCcw className="w-4 h-4" /> Try Again
                  </button>
                </div>
              </motion.div>
            )}
          </div>

          {/* Right Column: Order Summary Card */}
          {step === 'details' && (
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-white text-slate-900 rounded-3xl border border-slate-200 shadow-md p-6 space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <ShoppingBag className="h-4.5 w-4.5 text-primary" /> Order Summary
                  </h3>
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-primary bg-primary/10 px-2.5 py-1 rounded-full border border-primary/20">
                    {getPlanName(planId)} Access
                  </span>
                </div>

                <div className="space-y-4 text-left">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                        {getPlanName(planId)} Plan
                      </h4>
                      <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                        Billed {billingCycle}
                      </p>
                    </div>
                    <span className="text-base font-extrabold text-slate-900 font-mono">
                      {formatPrice(baseSubtotal)}
                    </span>
                  </div>

                  {(planId === 'pro' || planId === 'premium') && (
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

                  {!isFreeActivation && (
                    <>
                      <div className="flex justify-between items-center text-xs font-medium text-slate-500">
                        <span>Subtotal</span>
                        <span className="font-mono text-slate-800 font-semibold">{formatPrice(subtotalBeforeDiscount)}</span>
                      </div>

                      <AnimatePresence>
                        {appliedDiscount > 0 && (
                          <motion.div
                            initial={{ opacity: 0, height: 0, scale: 0.95 }}
                            animate={{ opacity: 1, height: 'auto', scale: 1 }}
                            exit={{ opacity: 0, height: 0, scale: 0.95 }}
                            transition={{ duration: 0.35, ease: 'easeOut' }}
                            className="overflow-hidden"
                          >
                            <div className="flex justify-between items-center text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200/80 shadow-2xs my-1">
                              <span className="flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-emerald-600 animate-bounce" />
                                Discount ({appliedDiscount * 100}% Off)
                              </span>
                              <span className="font-mono text-emerald-800 font-extrabold text-sm">- {formatPrice(discountAmount)}</span>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div className="flex justify-between items-center text-xs font-medium text-slate-500">
                        <span>GST (18%)</span>
                        <span className="font-mono text-slate-800 font-semibold">{formatPrice(gst)}</span>
                      </div>
                      <hr className="border-slate-100" />
                    </>
                  )}

                  <div className="flex justify-between items-center pt-1">
                    <span className="text-sm font-bold text-slate-900">Total Due</span>
                    <motion.span
                      key={total}
                      initial={{ scale: 1.3, color: '#16a34a' }}
                      animate={{ scale: 1, color: '#059669' }}
                      transition={{ type: 'spring', stiffness: 350, damping: 18 }}
                      className="text-2xl font-black text-emerald-600 font-mono tracking-tight"
                    >
                      {formatPrice(total)}
                    </motion.span>
                  </div>
                </div>

                {!isFreeActivation && (
                  <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-2xl text-left space-y-2">
                    <Label className="text-xs font-bold text-slate-700 block">Have a promo code?</Label>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        placeholder="Enter promo code"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                        className="bg-white rounded-xl text-xs py-1.5 focus:ring-primary/20 h-9"
                      />
                      <Button
                        type="button"
                        disabled={isApplyingCoupon || !couponCode.trim()}
                        onClick={handleApplyCoupon}
                        className="bg-primary hover:bg-primary/95 text-white font-bold text-xs h-9 px-4 rounded-xl cursor-pointer shadow-xs active:scale-95 transition-transform"
                      >
                        Apply
                      </Button>
                    </div>
                    {couponError && <p className="text-[11px] font-bold text-red-600 mt-1">{couponError}</p>}
                    {couponSuccess && (
                      <motion.p
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-[11px] font-bold text-emerald-600 mt-1 flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        {couponSuccess}
                      </motion.p>
                    )}
                  </div>
                )}

                {(planId === 'pro' || planId === 'premium') && (
                  <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-2xl text-left space-y-3">
                    <h4 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-primary" /> Package Features Included
                    </h4>
                    <ul className="space-y-2.5 text-slate-600 text-xs font-medium leading-normal">
                      <li className="flex items-start gap-2.5">
                        <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span><strong className="text-slate-900 font-semibold">Document Vault & EMD</strong> — Paperwork & HSN tracking</span>
                      </li>
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
                        <span><strong className="text-slate-900 font-semibold">Unlimited Catalog Downloads</strong> — MSTC & government PDFs</span>
                      </li>
                    </ul>
                  </div>
                )}

                {(planId === 'go' || planId === 'go-subscription') && (
                  <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-2xl text-left space-y-3">
                    <h4 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-primary" /> Package Features Included
                    </h4>
                    <ul className="space-y-2.5 text-slate-600 text-xs font-medium leading-normal">
                      <li className="flex items-start gap-2.5">
                        <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span><strong className="text-slate-900 font-semibold">Estimator Tool</strong> — GST, Tax & transport cost estimator</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span><strong className="text-slate-900 font-semibold">Max Bid Calculator</strong> — Calculate optimal bidding limit</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span><strong className="text-slate-900 font-semibold">Custom Alerts</strong> — Custom alerts & closing reminders</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span><strong className="text-slate-900 font-semibold">Document Vault</strong> — Document vault for paper organization</span>
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
        )}
        </div>
      </div>
    </div>
  );
}

export default CheckoutPage;
