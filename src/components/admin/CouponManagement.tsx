import { useState, useEffect } from 'react';
import { adminService } from '../../services/adminService';
import type { PromoCode } from '../../types/database.types';
import { Tag, Edit2, Trash2, Plus, XCircle, Search, Calendar, Loader2, ToggleLeft, ToggleRight, CheckCircle } from 'lucide-react';
import clsx from 'clsx';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'react-hot-toast';

const couponSchema = z.object({
  code: z.string()
    .min(3, "Code must be at least 3 characters")
    .max(20, "Code must be at most 20 characters")
    .regex(/^[A-Z0-9_-]+$/, "Code must be uppercase alphanumeric (dashes/underscores allowed)"),
  discount_percent: z.coerce.number()
    .int("Must be a whole number")
    .min(1, "Discount must be at least 1%")
    .max(100, "Discount cannot exceed 100%"),
  is_active: z.boolean(),
  expires_at: z.string().nullable().optional().or(z.literal('')),
});

type CouponFormValues = z.infer<typeof couponSchema>;

export function CouponManagement() {
  const [coupons, setCoupons] = useState<PromoCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'expired'>('all');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<CouponFormValues>({
    resolver: zodResolver(couponSchema),
    defaultValues: {
      code: '',
      discount_percent: 10,
      is_active: true,
      expires_at: ''
    }
  });

  const loadCoupons = async () => {
    setIsLoading(true);
    try {
      const data = await adminService.getPromoCodesAdmin();
      setCoupons(data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load coupons.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCoupons();
  }, []);

  const handleOpenModal = (coupon?: PromoCode) => {
    if (coupon) {
      setEditingId(coupon.id);
      setValue('code', coupon.code);
      setValue('discount_percent', coupon.discount_percent);
      setValue('is_active', coupon.is_active);
      
      if (coupon.expires_at) {
        // Format ISO string to YYYY-MM-DDThh:mm for datetime-local input
        const date = new Date(coupon.expires_at);
        const pad = (num: number) => String(num).padStart(2, '0');
        const formattedDate = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
        setValue('expires_at', formattedDate);
      } else {
        setValue('expires_at', '');
      }
    } else {
      setEditingId(null);
      reset({
        code: '',
        discount_percent: 10,
        is_active: true,
        expires_at: ''
      });
    }
    setIsModalOpen(true);
  };

  const onSubmitForm = async (values: CouponFormValues) => {
    const formattedValues = {
      ...values,
      code: values.code.trim().toUpperCase(),
      expires_at: values.expires_at ? new Date(values.expires_at).toISOString() : null
    };

    let success = false;
    try {
      if (editingId) {
        success = await adminService.updatePromoCode(editingId, formattedValues);
        if (success) toast.success('Promo code updated successfully!');
      } else {
        success = await adminService.createPromoCode(formattedValues);
        if (success) toast.success('Promo code created successfully!');
      }

      if (success) {
        setIsModalOpen(false);
        await loadCoupons();
      } else {
        toast.error('Failed to save promo code.');
      }
    } catch (err) {
      console.error(err);
      toast.error('An unexpected error occurred.');
    }
  };

  const handleDelete = async (id: string, code: string) => {
    if (confirm(`Are you sure you want to delete coupon code "${code}"?`)) {
      try {
        const success = await adminService.deletePromoCode(id);
        if (success) {
          toast.success('Promo code deleted successfully!');
          await loadCoupons();
        } else {
          toast.error('Failed to delete promo code.');
        }
      } catch (err) {
        console.error(err);
        toast.error('An unexpected error occurred.');
      }
    }
  };

  const toggleActiveStatus = async (coupon: PromoCode) => {
    try {
      const updatedStatus = !coupon.is_active;
      const success = await adminService.updatePromoCode(coupon.id, { is_active: updatedStatus });
      if (success) {
        toast.success(`Coupon ${coupon.code} ${updatedStatus ? 'activated' : 'deactivated'}.`);
        await loadCoupons();
      } else {
        toast.error('Failed to update status.');
      }
    } catch (err) {
      console.error(err);
      toast.error('An unexpected error occurred.');
    }
  };

  const filteredCoupons = coupons.filter((coupon) => {
    // Search filter
    if (searchQuery.trim() && !coupon.code.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    // Status filter
    const isExpired = coupon.expires_at && new Date(coupon.expires_at) < new Date();
    if (activeFilter === 'active') {
      return coupon.is_active && !isExpired;
    } else if (activeFilter === 'expired') {
      return !!isExpired;
    }

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
            <Tag className="w-6 h-6 stroke-[2]" />
          </div>
          <div className="text-left">
            <h2 className="text-xl font-bold text-slate-900">Promo Code Manager</h2>
            <p className="text-xs text-slate-500 font-medium">Create and manage discounts for billing subscriptions</p>
          </div>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-primary hover:bg-primary/95 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-primary/20"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          Create Promo Code
        </button>
      </div>

      {/* Filters & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white rounded-2xl border border-slate-200/80 p-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 text-slate-800 placeholder-slate-400 pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-semibold"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex border border-slate-200 rounded-xl p-1 bg-slate-50 self-start md:self-auto">
          {[
            { id: 'all', label: 'All Coupons' },
            { id: 'active', label: 'Active' },
            { id: 'expired', label: 'Expired' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id as any)}
              className={clsx(
                "px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer",
                activeFilter === tab.id
                  ? "bg-white text-primary shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="text-sm font-semibold">Loading promo codes...</span>
          </div>
        ) : filteredCoupons.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
            <Tag className="w-12 h-12 stroke-[1.5] text-slate-300" />
            <span className="text-sm font-bold text-slate-800">No promo codes found</span>
            <span className="text-xs text-slate-500 font-medium max-w-xs text-center">
              Create a new coupon to start offering discounts during subscription checkout.
            </span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  <th className="px-6 py-4">Promo Code</th>
                  <th className="px-6 py-4">Discount</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Expiration</th>
                  <th className="px-6 py-4">Created At</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700 font-medium">
                {filteredCoupons.map((coupon) => {
                  const isExpired = coupon.expires_at && new Date(coupon.expires_at) < new Date();
                  const isActive = coupon.is_active && !isExpired;

                  return (
                    <tr key={coupon.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-mono font-bold text-slate-900 bg-slate-100 border border-slate-200/80 px-2.5 py-1 rounded-lg">
                          {coupon.code}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-emerald-600 font-mono text-base">
                          {coupon.discount_percent}% Off
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => toggleActiveStatus(coupon)}
                          className="flex items-center gap-1.5 focus:outline-hidden cursor-pointer"
                        >
                          {isActive ? (
                            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                              <CheckCircle className="w-3.5 h-3.5" /> Active
                            </span>
                          ) : isExpired ? (
                            <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full border border-red-200">
                              <XCircle className="w-3.5 h-3.5" /> Expired
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-500 text-xs font-bold px-2 py-0.5 rounded-full border border-slate-200">
                              <XCircle className="w-3.5 h-3.5" /> Inactive
                            </span>
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-slate-500 text-xs">
                        {coupon.expires_at ? (
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5" />
                            {new Date(coupon.expires_at).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Never expires</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-400 text-xs font-mono">
                        {new Date(coupon.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenModal(coupon)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/5 transition-colors cursor-pointer"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(coupon.id, coupon.code)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE/EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div 
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Tag className="w-5 h-5 text-primary" />
                {editingId ? 'Edit Promo Code' : 'Create Promo Code'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <XCircle className="w-6 h-6 stroke-[1.5]" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSubmit(onSubmitForm)} className="p-6 space-y-4 text-left font-medium text-slate-700">
              {/* Code */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">Promo Code *</label>
                <input
                  type="text"
                  placeholder="e.g. STAY50"
                  {...register('code')}
                  className={clsx(
                    "w-full bg-slate-50 px-3.5 py-2.5 text-sm rounded-xl border focus:outline-hidden focus:ring-2 focus:ring-primary/20 transition-all font-semibold uppercase",
                    errors.code ? "border-red-300 focus:border-red-500" : "border-slate-200 focus:border-primary"
                  )}
                />
                {errors.code && (
                  <p className="text-xs font-bold text-red-500">{errors.code.message}</p>
                )}
                <p className="text-[10px] text-slate-400 leading-normal">
                  Uppercase letters, numbers, hyphens, and underscores only.
                </p>
              </div>

              {/* Discount Percent */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">Discount Percent *</label>
                <div className="relative">
                  <input
                    type="number"
                    placeholder="e.g. 30"
                    {...register('discount_percent')}
                    className={clsx(
                      "w-full bg-slate-50 pl-3.5 pr-8 py-2.5 text-sm rounded-xl border focus:outline-hidden focus:ring-2 focus:ring-primary/20 transition-all font-semibold",
                      errors.discount_percent ? "border-red-300 focus:border-red-500" : "border-slate-200 focus:border-primary"
                    )}
                  />
                  <span className="absolute right-3.5 top-2.5 text-slate-400 font-bold text-sm">%</span>
                </div>
                {errors.discount_percent && (
                  <p className="text-xs font-bold text-red-500">{errors.discount_percent.message}</p>
                )}
              </div>

              {/* Expiration Date */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">Expiration Date (Optional)</label>
                <input
                  type="datetime-local"
                  {...register('expires_at')}
                  className={clsx(
                    "w-full bg-slate-50 px-3.5 py-2.5 text-sm rounded-xl border focus:outline-hidden focus:ring-2 focus:ring-primary/20 transition-all font-semibold",
                    errors.expires_at ? "border-red-300 focus:border-red-500" : "border-slate-200 focus:border-primary"
                  )}
                />
                <p className="text-[10px] text-slate-400 leading-normal">
                  Leave blank if the coupon should never expire.
                </p>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between py-2 border-t border-slate-100 mt-2">
                <div>
                  <span className="text-xs font-bold text-slate-700 block">Active Status</span>
                  <span className="text-[10px] text-slate-400 font-medium">Deactivate to temporarily disable this coupon</span>
                </div>
                <input
                  type="checkbox"
                  id="is_active_toggle"
                  {...register('is_active')}
                  className="w-4 h-4 text-primary border-slate-300 rounded focus:ring-primary"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200/80 text-slate-700 font-bold text-sm py-2.5 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-primary hover:bg-primary/95 text-white font-bold text-sm py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                    </>
                  ) : 'Save Coupon'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
