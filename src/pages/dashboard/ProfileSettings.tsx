// @ts-nocheck
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Save, User, Building, Bell, Mail, Smartphone, Shield, CheckCircle2, Trash2, Globe, FileText, Lock, SlidersHorizontal, Eye, EyeOff, CreditCard, Frown, X, Gift, AlertTriangle, Sparkles } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import { authService } from '../../services/authService';
import { supabase } from '../../lib/supabase';
import { recommendationService } from '../../services/recommendationService';
import { getTrialStatus } from '../../utils/subscriptionUtils';

const profileSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: z.string().optional(),
});

type ProfileValues = z.infer<typeof profileSchema>;

export function ProfileSettings() {
  const { user, profile, setProfile, logout } = useAuthStore();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResettingRecommendations, setIsResettingRecommendations] = useState(false);
  const [recommendationResetError, setRecommendationResetError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'privacy' | 'security' | 'billing'>('profile');

  // Change Password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(null);

    if (newPassword.length < 6) {
      setPwError('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPwError('Passwords do not match.');
      return;
    }

    try {
      setIsSubmitting(true);
      await authService.updateUserPassword(newPassword);
      setPwSuccess('Password updated successfully!');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPwSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error changing password:', err);
      setPwError(err.message || 'Failed to update password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClearWatchlist = () => {
    if (!user) return;
    if (window.confirm('Are you sure you want to clear your interested watchlist? This will remove all items.')) {
      localStorage.setItem(`usr_interested_${user.id}`, '[]');
      setSuccessMsg('Watchlist cleared successfully.');
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  };

  const handleClearSearchFilters = async () => {
    if (user) await recommendationService.clearUserSearches(user.id);
    navigate('/auctions');
    setSuccessMsg('Search history and active filters cleared.');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleResetRecommendations = async () => {
    if (!user) return;
    const confirmed = window.confirm(
      'Reset your recommendation profile and answer the questionnaire again? Your watchlist and bids will not be deleted.'
    );
    if (!confirmed) return;

    setIsResettingRecommendations(true);
    setRecommendationResetError(null);
    try {
      await recommendationService.resetRecommendationProfile(user.id);
      navigate('/dashboard?setup=recommendations');
    } catch {
      setRecommendationResetError('Could not reset recommendations. Please try again.');
    } finally {
      setIsResettingRecommendations(false);
    }
  };

  const handleTerminateAccount = async () => {
    if (!user) return;
    const confirmInput = window.prompt(
      'WARNING: This action is permanent. Type "DELETE" to request account deletion:'
    );
    if (confirmInput !== 'DELETE') {
      alert('Deactivation cancelled.');
      return;
    }
    
    try {
      setIsSubmitting(true);
      localStorage.removeItem(`usr_interested_${user.id}`);
      localStorage.removeItem(`usr_reminders_${user.id}`);
      localStorage.removeItem(`usr_vendors_${user.id}`);
      
      await logout();
      alert('Account deletion requested. You have been successfully signed out.');
      window.location.href = '/';
    } catch (error) {
      console.error('Error requesting account deactivation:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
  // Cancellation Retention Flow States
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelStep, setCancelStep] = useState(1);
  const [cancelReason, setCancelReason] = useState('');
  const [customFeedback, setCustomFeedback] = useState('');
  const [preferredPricing, setPreferredPricing] = useState('');
  const [couponApplied, setCouponApplied] = useState(false);

  const handleCancelSubscription = () => {
    setIsCancelModalOpen(true);
    setCancelStep(1);
    setCancelReason('');
    setCustomFeedback('');
    setPreferredPricing('');
    setCouponApplied(false);
  };

  const applyRetentionCoupon = async () => {
    setCouponApplied(true);
    import('canvas-confetti').then((module) => {
      const confetti = module.default;
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 }
      });
    }).catch(err => console.log('Confetti import deferred'));

    toast.success('Awesome! Coupon STAY30 has been successfully applied to your account for 30% off your next renewals.');
    
    try {
      import('../../services/auditService').then(({ logUserActivity }) => {
        logUserActivity('apply_retention_coupon', 'profile', user?.id || '', { couponCode: 'STAY30' });
      });
    } catch (_) {}

    setTimeout(() => {
      setIsCancelModalOpen(false);
    }, 2000);
  };

  const confirmCancellation = async () => {
    if (!user) return;
    try {
      setIsSubmitting(true);
      setIsCancelModalOpen(false);
      const updatedProfile = await authService.updateProfile(user.id, {
        subscription_plan: 'explorer'
      });
      if (updatedProfile) {
        setProfile(updatedProfile);
        toast.success('Your subscription has been cancelled. Downgraded to the Free plan.');
      }
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      toast.error('Failed to cancel subscription. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Mock Notification State
  const [prefs, setPrefs] = useState({
    email_bids: true,
    email_tenders: true,
    email_marketing: false,
    push_outbid: true,
    push_system: true
  });

  useEffect(() => {
    if (user && activeTab === 'notifications') {
      const loadPrefs = async () => {
        const { data, error } = await supabase
          .from('user_notification_preferences')
          .select('*')
          .eq('user_id', user.id)
          .single();
        if (data && !error) {
          setPrefs({
            email_bids: data.email_bids,
            email_tenders: data.email_tenders,
            email_marketing: data.email_marketing,
            push_outbid: data.push_outbid,
            push_system: data.push_system
          });
        }
      };
      loadPrefs();
    }
  }, [user, activeTab]);

  const handleSavePrefs = async () => {
    if (!user) return;
    setIsSubmitting(true);
    
    const { error } = await supabase
      .from('user_notification_preferences')
      .upsert({
        user_id: user.id,
        ...prefs
      }, { onConflict: 'user_id' });

    setIsSubmitting(false);
    if (!error) {
      setSuccessMsg('Notification preferences saved successfully.');
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  };

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
  });

  useEffect(() => {
    if (profile) {
      reset({
        firstName: profile.first_name,
        lastName: profile.last_name,
        phone: profile.phone || '',
      });
    }
  }, [profile, reset]);

  const onSubmit = async (data: ProfileValues) => {
    if (!user) return;
    setIsSubmitting(true);
    setSuccessMsg(null);
    try {
      const updatedProfile = await authService.updateProfile(user.id, {
        first_name: data.firstName,
        last_name: data.lastName,
        phone: data.phone,
      });
      if (updatedProfile) {
        setProfile(updatedProfile);
        setSuccessMsg('Profile updated successfully!');
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (error) {
      console.error('Error updating profile:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Account Settings</h1>
        <p className="text-slate-500 mt-1">Manage your profile, organization, and preferences.</p>
      </div>

      <div className="flex space-x-4 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex items-center px-4 py-3 text-sm font-bold border-b-2 transition-colors ${
            activeTab === 'profile' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <User className="w-4 h-4 mr-2" />
          General Profile
        </button>
        <button
          onClick={() => setActiveTab('notifications')}
          className={`flex items-center px-4 py-3 text-sm font-bold border-b-2 transition-colors ${
            activeTab === 'notifications' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <Bell className="w-4 h-4 mr-2" />
          Alert Preferences
        </button>
        <button
          onClick={() => setActiveTab('privacy')}
          className={`flex items-center px-4 py-3 text-sm font-bold border-b-2 transition-colors ${
            activeTab === 'privacy' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <Shield className="w-4 h-4 mr-2" />
          Privacy & Data
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`flex items-center px-4 py-3 text-sm font-bold border-b-2 transition-colors ${
            activeTab === 'security' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <Lock className="w-4 h-4 mr-2" />
          Security
        </button>
        <button
          onClick={() => setActiveTab('billing')}
          className={`flex items-center px-4 py-3 text-sm font-bold border-b-2 transition-colors ${
            activeTab === 'billing' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <CreditCard className="w-4 h-4 mr-2" />
          Billing & Subscription
        </button>
      </div>

      {successMsg && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded text-sm font-medium flex items-center">
          <CheckCircle2 className="w-5 h-5 mr-2" />
          {successMsg}
        </div>
      )}

      {/* Personal Information */}
      {activeTab === 'profile' && (
        <div className="space-y-8">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 p-6 flex items-center">
          <User className="w-6 h-6 text-primary mr-3" />
          <h2 className="text-lg font-bold text-slate-900">Personal Information</h2>
        </div>
        
        <form onSubmit={handleSubmit(onSubmit)} className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">First Name</label>
              <input
                {...register('firstName')}
                type="text"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary shadow-sm"
              />
              {errors.firstName && <p className="mt-1 text-sm text-destructive">{errors.firstName.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Last Name</label>
              <input
                {...register('lastName')}
                type="text"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary shadow-sm"
              />
              {errors.lastName && <p className="mt-1 text-sm text-destructive">{errors.lastName.message}</p>}
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Email Address</label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full px-4 py-2 border border-slate-200 bg-slate-50 rounded-lg text-slate-500 cursor-not-allowed"
              />
              <p className="mt-1 text-xs text-slate-500">Email cannot be changed.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Phone Number</label>
              <input
                {...register('phone')}
                type="tel"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary shadow-sm"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center px-6 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-primary hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary shadow-sm disabled:opacity-50"
            >
              <Save className="w-4 h-4 mr-2" />
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
          </div>
        </div>
      )}

      {activeTab === 'notifications' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-lg font-bold text-slate-900">Communication Preferences</h2>
            <p className="text-sm text-slate-500 mt-1">Manage how and when we contact you.</p>
          </div>
          
          <div className="p-6 space-y-8">
            {/* Email Preferences */}
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center">
                <Mail className="w-4 h-4 mr-2 text-primary" /> Email Notifications
              </h3>
              <div className="space-y-4">
                <label className="flex items-start cursor-pointer">
                  <div className="relative flex items-center h-5">
                    <input type="checkbox" className="form-checkbox h-4 w-4 text-primary border-slate-300 rounded focus:ring-primary" checked={prefs.email_bids} onChange={(e) => setPrefs({...prefs, email_bids: e.target.checked})} />
                  </div>
                  <div className="ml-3 text-sm">
                    <span className="font-bold text-slate-900 block">Bidding & Auction Updates</span>
                    <span className="text-slate-500">Receive emails for bid confirmations, outbid alerts, and auction wins.</span>
                  </div>
                </label>
                
                <label className="flex items-start cursor-pointer">
                  <div className="relative flex items-center h-5">
                    <input type="checkbox" className="form-checkbox h-4 w-4 text-primary border-slate-300 rounded focus:ring-primary" checked={prefs.email_tenders} onChange={(e) => setPrefs({...prefs, email_tenders: e.target.checked})} />
                  </div>
                  <div className="ml-3 text-sm">
                    <span className="font-bold text-slate-900 block">e-Tender Updates</span>
                    <span className="text-slate-500">Receive emails regarding tender submissions and evaluation statuses.</span>
                  </div>
                </label>

                <label className="flex items-start cursor-pointer">
                  <div className="relative flex items-center h-5">
                    <input type="checkbox" className="form-checkbox h-4 w-4 text-primary border-slate-300 rounded focus:ring-primary" checked={prefs.email_marketing} onChange={(e) => setPrefs({...prefs, email_marketing: e.target.checked})} />
                  </div>
                  <div className="ml-3 text-sm">
                    <span className="font-bold text-slate-900 block">Marketing & Newsletters</span>
                    <span className="text-slate-500">Receive occasional emails about new features and platform news.</span>
                  </div>
                </label>
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* In-App / Push Preferences */}
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center">
                <Smartphone className="w-4 h-4 mr-2 text-primary" /> In-App Alerts
              </h3>
              <div className="space-y-4">
                <label className="flex items-start cursor-pointer">
                  <div className="relative flex items-center h-5">
                    <input type="checkbox" className="form-checkbox h-4 w-4 text-primary border-slate-300 rounded focus:ring-primary" checked={prefs.push_outbid} onChange={(e) => setPrefs({...prefs, push_outbid: e.target.checked})} />
                  </div>
                  <div className="ml-3 text-sm">
                    <span className="font-bold text-slate-900 block">Urgent Outbid Alerts</span>
                    <span className="text-slate-500">Push an immediate banner to my screen if I am outbid while online.</span>
                  </div>
                </label>
                
                <label className="flex items-start cursor-pointer">
                  <div className="relative flex items-center h-5">
                    <input type="checkbox" className="form-checkbox h-4 w-4 text-primary border-slate-300 rounded focus:ring-primary" checked={prefs.push_system} onChange={(e) => setPrefs({...prefs, push_system: e.target.checked})} />
                  </div>
                  <div className="ml-3 text-sm">
                    <span className="font-bold text-slate-900 block">System Announcements</span>
                    <span className="text-slate-500">Show the global banner for maintenance and important system notices.</span>
                  </div>
                </label>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                onClick={handleSavePrefs}
                disabled={isSubmitting}
                className="px-6 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary-700 transition-colors flex items-center disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : <><Save className="w-4 h-4 mr-2" /> Save Preferences</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'privacy' && (
        <div className="space-y-8">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-200 p-6 flex items-center">
              <SlidersHorizontal className="w-6 h-6 text-primary mr-3" />
              <h2 className="text-lg font-bold text-slate-900">Recommendation Settings</h2>
            </div>
            <div className="p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="font-semibold text-slate-900">Reset personalized recommendations</p>
                <p className="text-sm text-slate-500 mt-1">
                  Clears questionnaire answers and learned search interests, then starts the setup questionnaire again.
                </p>
                {recommendationResetError && (
                  <p className="text-sm text-red-600 mt-2" role="alert">{recommendationResetError}</p>
                )}
              </div>
              <button
                onClick={handleResetRecommendations}
                disabled={isResettingRecommendations}
                className="shrink-0 inline-flex items-center justify-center px-4 py-2.5 bg-primary hover:bg-primary-700 text-sm font-semibold rounded-lg text-white transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isResettingRecommendations ? 'Resetting...' : 'Reset Recommendations'}
              </button>
            </div>
          </div>

          {/* Account Settings Panel */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-200 p-6 flex items-center">
              <User className="w-6 h-6 text-primary mr-3" />
              <h2 className="text-lg font-bold text-slate-900">Account Settings</h2>
            </div>
            <div className="p-6">
              <p className="text-slate-600 text-sm mb-4 leading-relaxed">
                You can edit your profile information (such as your name, company details, phone number, and contact preferences) at any time through the Profile Settings page.
              </p>
              <button
                onClick={() => setActiveTab('profile')}
                className="inline-flex items-center px-4 py-2 border border-slate-300 text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 transition-colors shadow-sm"
              >
                Go to Profile Settings
              </button>
            </div>
          </div>

          {/* Data Deletion Panel */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-200 p-6 flex items-center">
              <Shield className="w-6 h-6 text-red-500 mr-3" />
              <h2 className="text-lg font-bold text-slate-900">Data Deletion</h2>
            </div>
            <div className="p-6 space-y-6">
              <p className="text-slate-600 text-sm leading-relaxed">
                You can manage the removal of your active data from the platform, delete your watchlist items, remove documents from your vault, or request account deletion.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="border border-slate-200 rounded-xl p-4 flex flex-col justify-between hover:shadow-sm transition-shadow">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm mb-1">Clear Watchlist</h3>
                    <p className="text-xs text-slate-500 mb-4">Remove all auctions and catalog items from your interested list.</p>
                  </div>
                  <button
                    onClick={handleClearWatchlist}
                    className="w-full text-center py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  >
                    Clear Watchlist
                  </button>
                </div>

                <div className="border border-slate-200 rounded-xl p-4 flex flex-col justify-between hover:shadow-sm transition-shadow">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm mb-1">Remove Documents</h3>
                    <p className="text-xs text-slate-500 mb-4">View and delete individual KYC and transaction documents from your vault.</p>
                  </div>
                  <button
                    onClick={() => navigate('/dashboard/documents')}
                    className="w-full text-center py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  >
                    Manage Vault
                  </button>
                </div>

                <div className="border border-red-100 rounded-xl p-4 flex flex-col justify-between hover:shadow-sm transition-shadow bg-red-50/10">
                  <div>
                    <h3 className="font-bold text-red-600 text-sm mb-1">Delete Account</h3>
                    <p className="text-xs text-slate-500 mb-4">Permanently delete your profile and deactivate your account credentials.</p>
                  </div>
                  <button
                    onClick={handleTerminateAccount}
                    className="w-full text-center py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm cursor-pointer"
                  >
                    Delete Account
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Search History Panel */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-200 p-6 flex items-center">
              <Globe className="w-6 h-6 text-primary mr-3" />
              <h2 className="text-lg font-bold text-slate-900">Search History & Filters</h2>
            </div>
            <div className="p-6">
              <p className="text-slate-600 text-sm mb-4 leading-relaxed">
                Clear recommendation search history stored with your account and reset active marketplace filters.
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={handleClearSearchFilters}
                  className="inline-flex items-center px-4 py-2 border border-slate-300 text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
                >
                  Clear Search History & Filters
                </button>
                <button
                  onClick={() => navigate('/auctions')}
                  className="inline-flex items-center px-4 py-2 bg-primary hover:bg-primary-700 text-sm font-medium rounded-lg text-white transition-colors shadow-sm cursor-pointer"
                >
                  Go to Marketplace
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'security' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 border-b border-slate-200 p-6 flex items-center">
            <Lock className="w-6 h-6 text-primary mr-3" />
            <h2 className="text-lg font-bold text-slate-900">Change Password</h2>
          </div>
          
          <form onSubmit={handleChangePassword} className="p-6 max-w-lg space-y-6">
            {pwError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm font-medium">
                {pwError}
              </div>
            )}
            
            {pwSuccess && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm font-medium">
                {pwSuccess}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">New Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min. 6 characters)"
                  className="w-full px-4 py-2 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary shadow-xs"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Confirm New Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="w-full px-4 py-2 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary shadow-xs"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center px-6 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-primary hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary shadow-xs disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-4 h-4 mr-2" />
                {isSubmitting ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'billing' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 border-b border-slate-200 p-6 flex items-center">
            <CreditCard className="w-6 h-6 text-primary mr-3" />
            <h2 className="text-lg font-bold text-slate-900">Manage Subscription</h2>
          </div>

          <div className="p-6 space-y-6">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Current Plan</p>
                <h3 className="text-xl font-black text-slate-800 mt-1 flex items-center gap-2">
                  {profile?.subscription_plan === 'pro' ? 'Business Plan' :
                   (profile?.subscription_plan === 'go' || profile?.subscription_plan === 'go-subscription') ? 'Individual Plan' :
                   profile?.subscription_plan === 'enterprise' ? 'Enterprise Plan' : 'Free Plan'}
                </h3>
                {getTrialStatus(user?.id).isExpired && (
                  <p className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg mt-2 inline-block">
                    Your 7-day free trial has ended. Your subscription is over.
                  </p>
                )}
                {!getTrialStatus(user?.id).isExpired && profile?.subscription_plan === 'pro' && (
                  <p className="text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg mt-2 inline-block">
                    {getTrialStatus(user?.id).statusText}
                  </p>
                )}
              </div>
              <div>
                {(!profile?.subscription_plan || profile.subscription_plan === 'explorer') ? (
                  <Link
                    to="/pricing"
                    className="inline-flex items-center px-4 py-2 text-xs font-bold text-white bg-primary hover:bg-primary-700 rounded-xl transition-all shadow-xs"
                  >
                    Upgrade Plan
                  </Link>
                ) : profile.subscription_plan === 'enterprise' ? (
                  <Link
                    to="/contact"
                    className="inline-flex items-center px-4 py-2 text-xs font-bold text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-xl transition-all"
                  >
                    Contact Account Manager
                  </Link>
                ) : (
                  <button
                    onClick={handleCancelSubscription}
                    disabled={isSubmitting}
                    className="inline-flex items-center px-4 py-2 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                  >
                    Cancel Subscription
                  </button>
                )}
              </div>
            </div>

            <div className="text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-6">
              <h4 className="font-bold text-slate-800 mb-2">Subscription & Billing Guidelines</h4>
              <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-500">
                <li>Paid subscriptions (Individual & Business) are billed monthly or annually depending on your selection.</li>
                <li>You can cancel your active paid plan at any time. When cancelled, your account will instantly downgrade to the Free plan.</li>
                <li>For any invoice disputes, refunds, or custom Enterprise integrations, please contact our support team.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {isCancelModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center text-red-500">
                  <Frown className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <h3 className="text-lg font-black text-slate-900">We're Sad to See You Go</h3>
                  <p className="text-xs text-slate-500 font-medium">Step {cancelStep} of 3</p>
                </div>
              </div>
              <button 
                onClick={() => setIsCancelModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors border-0 bg-transparent cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 overflow-y-auto flex-1 text-left space-y-4">
              {cancelStep === 1 && (
                <div className="space-y-4">
                  <p className="text-sm text-slate-600 leading-relaxed font-semibold">
                    Could you tell us why you are considering cancelling your subscription? Your feedback helps us improve.
                  </p>
                  
                  <div className="space-y-2">
                    {[
                      { id: 'expensive', label: 'It is too expensive / out of budget' },
                      { id: 'missing_features', label: 'Missing critical features I need' },
                      { id: 'hard_use', label: 'Too difficult or complex to use' },
                      { id: 'temporary', label: 'Temporary project completed, no longer needed' },
                      { id: 'other', label: 'Other reason' }
                    ].map((opt) => (
                      <label 
                        key={opt.id}
                        className={`flex items-start p-3 rounded-xl border-2 transition-all cursor-pointer ${
                          cancelReason === opt.id 
                            ? 'border-primary bg-primary/5 text-primary' 
                            : 'border-slate-200 hover:border-slate-300 text-slate-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name="cancelReason"
                          value={opt.id}
                          checked={cancelReason === opt.id}
                          onChange={(e) => setCancelReason(e.target.value)}
                          className="mt-1 mr-3 h-4 w-4 text-primary focus:ring-primary border-slate-300"
                        />
                        <span className="text-xs font-bold">{opt.label}</span>
                      </label>
                    ))}
                  </div>

                  {cancelReason && (
                    <div className="space-y-2 pt-2">
                      <label className="text-xs font-bold text-slate-700">
                        {cancelReason === 'missing_features' ? 'What features would have kept you?' : 'Tell us more (optional):'}
                      </label>
                      <textarea
                        value={customFeedback}
                        onChange={(e) => setCustomFeedback(e.target.value)}
                        placeholder="Your thoughts..."
                        className="w-full min-h-[80px] p-3 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-slate-800"
                      />
                    </div>
                  )}
                </div>
              )}

              {cancelStep === 2 && (
                <div className="space-y-6">
                  {cancelReason === 'expensive' ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3">
                        <Gift className="w-8 h-8 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-sm font-black text-emerald-800">Special Retention Discount!</h4>
                          <p className="text-xs text-emerald-700 mt-1 leading-relaxed font-medium">
                            We value having you as a subscriber. We'd love to offer you 30% off your subscription for the next 3 months! Use this coupon code or click below to apply it immediately.
                          </p>
                        </div>
                      </div>

                      <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-center space-y-2">
                        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Your discount coupon code</span>
                        <span className="font-mono text-2xl font-black text-slate-800 bg-white border px-4 py-1.5 rounded-lg shadow-xs inline-block tracking-wider">
                          STAY30
                        </span>
                      </div>

                      <div className="space-y-2.5">
                        <label className="text-xs font-bold text-slate-700 block">
                          What monthly price would you prefer or feel is fair? (INR / month)
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {['₹299', '₹499', '₹999'].map((priceOpt) => (
                            <button
                              key={priceOpt}
                              onClick={() => setPreferredPricing(priceOpt)}
                              className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                                preferredPricing === priceOpt 
                                  ? 'bg-primary border-primary text-white shadow-xs' 
                                  : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                              }`}
                            >
                              {priceOpt}/mo
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl flex items-start gap-3">
                        <Sparkles className="w-8 h-8 text-primary shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-sm font-black text-blue-800">Exclusive Reward to Stay!</h4>
                          <p className="text-xs text-blue-700 mt-1 leading-relaxed font-medium">
                            We are committed to resolving your concerns. As a thank you for your feedback, we've prepared a 30% off coupon code for you. Apply it to get immediate savings on your next renewals!
                          </p>
                        </div>
                      </div>

                      <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-center space-y-2">
                        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Use coupon code</span>
                        <span className="font-mono text-2xl font-black text-slate-800 bg-white border px-4 py-1.5 rounded-lg shadow-xs inline-block tracking-wider">
                          STAY30
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {cancelStep === 3 && (
                <div className="space-y-5">
                  <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3">
                    <AlertTriangle className="w-8 h-8 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-black text-rose-800">Confirm Deactivation</h4>
                      <p className="text-xs text-rose-700 mt-1 leading-relaxed font-medium">
                        If you proceed, your subscription will end immediately. You will immediately lose access to all premium tools:
                      </p>
                    </div>
                  </div>

                  <ul className="space-y-2.5 text-xs text-slate-600 font-medium pl-2">
                    <li className="flex items-start gap-2">
                      <span className="text-red-500 font-bold">✕</span>
                      <span>AI Win-Probability & Bid Optimization Engine</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-500 font-bold">✕</span>
                      <span>Real-time Scrap vs. Resale Valuation Margins</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-500 font-bold">✕</span>
                      <span>Automated closing alerts, reminders & visual calendar</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-500 font-bold">✕</span>
                      <span>GST, taxes, transport estimator and catalog document vault</span>
                    </li>
                  </ul>

                  <p className="text-xs font-bold text-slate-400 text-center uppercase tracking-wide pt-2">
                    Are you absolutely sure you want to degrade?
                  </p>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="p-6 border-t border-slate-100 flex items-center justify-between bg-slate-50">
              {cancelStep === 1 && (
                <>
                  <button
                    onClick={() => setIsCancelModalOpen(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all cursor-pointer"
                  >
                    Keep Premium
                  </button>
                  <button
                    onClick={() => setCancelStep(2)}
                    disabled={!cancelReason}
                    className="px-5 py-2 text-xs font-bold text-white bg-primary hover:bg-primary-700 rounded-xl disabled:opacity-50 transition-all cursor-pointer shadow-md shadow-primary/10"
                  >
                    Continue
                  </button>
                </>
              )}

              {cancelStep === 2 && (
                <>
                  <button
                    onClick={() => setCancelStep(3)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 bg-transparent hover:text-slate-800 transition-all border-0 cursor-pointer"
                  >
                    No thanks, continue cancellation
                  </button>
                  
                  {couponApplied ? (
                    <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                      ✓ Coupon Applied!
                    </span>
                  ) : (
                    <button
                      onClick={applyRetentionCoupon}
                      className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all cursor-pointer shadow-md shadow-emerald-600/10 flex items-center gap-1.5"
                    >
                      <Gift className="w-3.5 h-3.5" /> Apply Coupon & Save 30%
                    </button>
                  )}
                </>
              )}

              {cancelStep === 3 && (
                <>
                  <button
                    onClick={() => setIsCancelModalOpen(false)}
                    className="px-5 py-2.5 text-xs font-bold text-white bg-primary hover:bg-primary-700 rounded-xl transition-all cursor-pointer shadow-md shadow-primary/20"
                  >
                    Keep My Subscription
                  </button>
                  <button
                    onClick={confirmCancellation}
                    className="px-4 py-2.5 text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl transition-all cursor-pointer border-0 bg-transparent"
                  >
                    Cancel Subscription anyway
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
