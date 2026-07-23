import { useState, useEffect } from 'react';
import { Building2, Save, MapPin, Truck, Award, Phone } from 'lucide-react';
import { logisticsService } from '../../services/logisticsService';
import { useAuthStore } from '../../store/authStore';
import { toast } from 'react-hot-toast';

export function LogisticsProfileSettings() {
  const { user } = useAuthStore();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [formData, setFormData] = useState({
    company_name: '',
    service_areas: '',
    vehicle_types: '',
    base_rates: '',
    certifications: '',
    description: '',
    phone: '',
    email: '',
    is_accepting_requests: true
  });

  useEffect(() => {
    loadProfile();
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const profile = await logisticsService.getLogisticsProfile(user.id);
      if (profile) {
        setFormData({
          company_name: profile.company_name || '',
          service_areas: (profile.service_areas || []).join(', '),
          vehicle_types: (profile.vehicle_types || []).join(', '),
          base_rates: profile.base_rates || '',
          certifications: profile.certifications || '',
          description: profile.description || '',
          phone: profile.contact_info?.phone || '',
          email: profile.contact_info?.email || '',
          is_accepting_requests: profile.is_accepting_requests ?? true
        });
      }
    } catch (error) {
      console.error('Failed to load profile', error);
      toast.error('Failed to load your profile details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.company_name.trim()) {
      toast.error('Company Name is required');
      return;
    }

    setIsSaving(true);
    try {
      await logisticsService.updateLogisticsProfile(user.id, {
        company_name: formData.company_name,
        service_areas: formData.service_areas.split(',').map(s => s.trim()).filter(Boolean),
        vehicle_types: formData.vehicle_types.split(',').map(s => s.trim()).filter(Boolean),
        base_rates: formData.base_rates,
        certifications: formData.certifications,
        description: formData.description,
        is_accepting_requests: formData.is_accepting_requests,
        contact_info: {
          phone: formData.phone,
          email: formData.email
        }
      });
      toast.success('Profile updated successfully!');
    } catch (error) {
      console.error('Failed to save', error);
      toast.error('Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center">
          <Building2 className="w-6 h-6 mr-3 text-primary" />
          Public Logistics Profile
        </h1>
        <p className="text-slate-500 mt-1">This information will be visible to users when they request shipping quotes.</p>
      </div>

      <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
        
        <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Accepting Quote Requests</h3>
            <p className="text-xs text-slate-500 mt-0.5">If turned off, you will not appear in the Quote Builder for users to select.</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              className="sr-only peer" 
              checked={formData.is_accepting_requests}
              onChange={(e) => setFormData({ ...formData, is_accepting_requests: e.target.checked })}
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>
        
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">Basic Details</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Company / Provider Name *</label>
              <input
                type="text"
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                placeholder="e.g. BlueDart Logistics Ltd."
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/20 outline-none transition-all font-semibold"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center">
                <MapPin className="w-3.5 h-3.5 mr-1" /> Service Areas
              </label>
              <input
                type="text"
                value={formData.service_areas}
                onChange={(e) => setFormData({ ...formData, service_areas: e.target.value })}
                placeholder="e.g. Mumbai, Delhi, All India"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium"
              />
              <p className="text-[10px] text-slate-400">Comma separated cities or regions</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center">
                <Truck className="w-3.5 h-3.5 mr-1" /> Vehicle Fleet
              </label>
              <input
                type="text"
                value={formData.vehicle_types}
                onChange={(e) => setFormData({ ...formData, vehicle_types: e.target.value })}
                placeholder="e.g. Flatbed Trucks, 20ft Containers"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium"
              />
              <p className="text-[10px] text-slate-400">Comma separated types</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">Pricing & Credentials</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Base Rates (Optional)</label>
              <input
                type="text"
                value={formData.base_rates}
                onChange={(e) => setFormData({ ...formData, base_rates: e.target.value })}
                placeholder="e.g. ₹50 per KM"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center">
                <Award className="w-3.5 h-3.5 mr-1" /> Certifications
              </label>
              <input
                type="text"
                value={formData.certifications}
                onChange={(e) => setFormData({ ...formData, certifications: e.target.value })}
                placeholder="e.g. ISO 9001, Hazardous Materials"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">Contact Info & About</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center">
                <Phone className="w-3.5 h-3.5 mr-1" /> Support Phone
              </label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+91..."
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Support Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="support@company.com"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium"
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Company Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe your logistics capabilities and history..."
                rows={4}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium resize-none"
              />
            </div>
          </div>
        </div>

        <div className="pt-4 flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-3 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl flex items-center transition-all shadow-md hover:shadow-lg disabled:opacity-50"
          >
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Profile Details'}
          </button>
        </div>
      </form>
    </div>
  );
}
