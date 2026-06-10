// @ts-nocheck
import { useEffect, useState } from 'react';
import { Users, CheckCircle2, ShieldAlert, Edit2, Shield } from 'lucide-react';
import { adminService } from '../../services/adminService';
import clsx from 'clsx';

export function UserManagement() {
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setIsLoading(true);
    const data = await adminService.getUsers();
    setUsers(data);
    setIsLoading(false);
  };

  const handleRoleChange = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'buyer' ? 'seller' : 'buyer';
    if (!window.confirm(`Are you sure you want to change this user's role to ${newRole.toUpperCase()}?`)) return;

    setUpdatingId(userId);
    const success = await adminService.updateUserRole(userId, newRole);
    if (success) {
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
    }
    setUpdatingId(null);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900 flex items-center">
          <Users className="w-5 h-5 mr-2 text-primary" /> User Database
        </h2>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
              <th className="px-6 py-4 font-semibold">User Info</th>
              <th className="px-6 py-4 font-semibold">Contact</th>
              <th className="px-6 py-4 font-semibold">Role</th>
              <th className="px-6 py-4 font-semibold">Organization / KYC</th>
              <th className="px-6 py-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-slate-50">
                <td className="px-6 py-4">
                  <p className="text-sm font-bold text-slate-900">{user.first_name} {user.last_name}</p>
                  <p className="text-xs text-slate-500 font-mono mt-0.5" title={user.id}>{user.id.split('-')[0]}...</p>
                </td>
                <td className="px-6 py-4">
                  <p className="text-sm text-slate-600">{user.email}</p>
                  <p className="text-xs text-slate-500">{user.phone_number || 'N/A'}</p>
                </td>
                <td className="px-6 py-4">
                  <span className={clsx(
                    "px-2.5 py-1 text-xs font-bold rounded-md uppercase tracking-wide",
                    user.role === 'admin' || user.role === 'superadmin' ? "bg-purple-100 text-purple-700" :
                    user.role === 'seller' ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                  )}>
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {user.organization_id ? (
                    <div className="flex items-center text-sm font-bold text-slate-900">
                      <CheckCircle2 className="w-4 h-4 text-green-500 mr-1.5" /> Org Attached
                    </div>
                  ) : (
                    <div className="flex items-center text-sm text-slate-500">
                      <ShieldAlert className="w-4 h-4 mr-1.5" /> Pending KYC
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  {(user.role === 'buyer' || user.role === 'seller') && (
                    <button 
                      onClick={() => handleRoleChange(user.id, user.role)}
                      disabled={updatingId === user.id}
                      className="inline-flex items-center px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-md transition-colors disabled:opacity-50"
                    >
                      <Shield className="w-3.5 h-3.5 mr-1" />
                      {updatingId === user.id ? 'Updating...' : `Make ${user.role === 'buyer' ? 'Seller' : 'Buyer'}`}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
