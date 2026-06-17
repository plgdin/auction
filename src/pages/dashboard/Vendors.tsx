import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { dashboardService } from '../../services/dashboardService';
import type { Vendor } from '../../services/dashboardService';
import { Plus, Edit2, Trash2, Mail, Phone, User, X, Search } from 'lucide-react';
import { toast } from 'react-hot-toast';

export function Vendors() {
  const { user } = useAuthStore();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '' });

  useEffect(() => {
    if (user?.id) {
      setVendors(dashboardService.getVendors(user.id));
    }
  }, [user]);

  const handleOpenAdd = () => {
    setEditingVendor(null);
    setFormData({ name: '', email: '', phone: '' });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setFormData({ name: vendor.name, email: vendor.email, phone: vendor.phone });
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (!user?.id) return;
    if (window.confirm('Are you sure you want to delete this vendor from your list?')) {
      dashboardService.deleteVendor(user.id, id);
      setVendors(dashboardService.getVendors(user.id));
      toast.success('Vendor removed successfully');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    if (!formData.name.trim()) {
      toast.error('Please enter a vendor name');
      return;
    }

    if (editingVendor) {
      dashboardService.updateVendor(user.id, {
        id: editingVendor.id,
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
      });
      toast.success('Vendor updated successfully');
    } else {
      dashboardService.addVendor(user.id, formData);
      toast.success('Vendor added successfully');
    }

    setVendors(dashboardService.getVendors(user.id));
    setIsModalOpen(false);
  };

  const filteredVendors = vendors.filter(v =>
    v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.phone.includes(searchTerm)
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Personal Vendors</h1>
          <p className="text-slate-500">Manage your network of trusted logistics providers, scrap dealers, and contractors.</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="flex items-center px-4 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl shadow-sm hover:bg-primary-700 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Vendor
        </button>
      </div>

      {/* Search and List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center">
          <div className="relative flex-grow max-w-md">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-450" />
            <input
              type="text"
              placeholder="Search vendors by name, email, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-250 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {filteredVendors.length === 0 ? (
            <div className="text-center py-16 px-4">
              <User className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900">No vendors found</h3>
              <p className="text-slate-500 mt-1">Try refining your search or add a new vendor to your list.</p>
            </div>
          ) : (
            filteredVendors.map((vendor) => (
              <div
                key={vendor.id}
                className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-lg shrink-0">
                    {vendor.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{vendor.name}</h3>
                    <div className="flex flex-wrap gap-x-6 gap-y-1 mt-1.5 text-sm text-slate-500">
                      {vendor.email && (
                        <span className="flex items-center">
                          <Mail className="w-4 h-4 mr-1.5 text-slate-400" />
                          {vendor.email}
                        </span>
                      )}
                      {vendor.phone && (
                        <span className="flex items-center">
                          <Phone className="w-4 h-4 mr-1.5 text-slate-400" />
                          {vendor.phone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={() => handleOpenEdit(vendor)}
                    className="p-2 border border-slate-200 text-slate-650 hover:bg-slate-50 hover:border-slate-350 rounded-lg transition-colors cursor-pointer"
                    title="Edit Vendor"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(vendor.id)}
                    className="p-2 border border-slate-200 text-red-600 hover:bg-red-50 hover:border-red-200 rounded-lg transition-colors cursor-pointer"
                    title="Delete Vendor"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/45 backdrop-blur-md">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-150 flex justify-between items-center bg-slate-55/30">
              <h3 className="font-bold text-slate-900 text-lg">
                {editingVendor ? 'Edit Vendor Details' : 'Add New Vendor'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Vendor Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Metro Scrap Solutions"
                  className="w-full px-3.5 py-2.5 border border-slate-250 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Email Address</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="e.g. sales@metroscrap.in"
                  className="w-full px-3.5 py-2.5 border border-slate-250 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Phone Number</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="e.g. +91 99999 88888"
                  className="w-full px-3.5 py-2.5 border border-slate-250 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 border border-slate-250 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl shadow-sm hover:bg-primary-700 transition-all cursor-pointer"
                >
                  {editingVendor ? 'Save Changes' : 'Add Vendor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
