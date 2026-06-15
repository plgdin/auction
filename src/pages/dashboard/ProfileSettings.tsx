// @ts-nocheck
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Save, User, Building, Bell, Mail, Smartphone, Shield, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { authService } from '../../services/authService';
import { supabase } from '../../lib/supabase';

const profileSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: z.string().optional(),
});

type ProfileValues = z.infer<typeof profileSchema>;

export function ProfileSettings() {
  const { user, profile, setProfile } = useAuthStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'notifications'>('profile');

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
    </div>
  );
}
