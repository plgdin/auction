// @ts-nocheck
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Save, User, Building, Bell, Mail, Smartphone, Shield, CheckCircle2, Trash2, Globe, FileText, Lock, SlidersHorizontal, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { authService } from '../../services/authService';
import { supabase } from '../../lib/supabase';
import { recommendationService } from '../../services/recommendationService';

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
  const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'privacy' | 'security'>('profile');

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
      'WARNING: This action is permanent. Type "DELETE" to request account termination:'
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
      alert('Account deactivation and termination requested. You have been successfully signed out.');
      window.location.href = '/';
    } catch (error) {
      console.error('Error requesting account deactivation:', error);
      alert('An error occurred. Please try again.');
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
                You can manage the removal of your active data from the platform, delete your watchlist items, remove documents from your vault, or request account termination.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="border border-slate-200 rounded-xl p-4 flex flex-col justify-between hover:shadow-sm transition-shadow">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm mb-1">Clear Watchlist</h3>
                    <p className="text-xs text-slate-500 mb-4">Remove all auctions and catalog items from your interested list.</p>
                  </div>
                  <button
                    onClick={handleClearWatchlist}
                    className="w-full text-center py-2 bg-slate-150 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
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
                    className="w-full text-center py-2 bg-slate-150 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  >
                    Manage Vault
                  </button>
                </div>

                <div className="border border-red-100 rounded-xl p-4 flex flex-col justify-between hover:shadow-sm transition-shadow bg-red-50/10">
                  <div>
                    <h3 className="font-bold text-red-600 text-sm mb-1">Terminate Account</h3>
                    <p className="text-xs text-slate-500 mb-4">Permanently delete your profile and deactivate your account credentials.</p>
                  </div>
                  <button
                    onClick={handleTerminateAccount}
                    className="w-full text-center py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm cursor-pointer"
                  >
                    Request Termination
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
              <div className="bg-green-55 border border-green-200 text-green-705 px-4 py-3 rounded-lg text-sm font-medium">
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
    </div>
  );
}
