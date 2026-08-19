// @ts-nocheck
import { useEffect, useState } from 'react';
import { Users, CheckCircle2, ShieldAlert, Shield, Globe, Clock, X, Activity, ExternalLink, ShieldCheck, Lock } from 'lucide-react';
import { adminService } from '../../services/adminService';
import { ALL_AUCTION_TYPES } from '../../hooks/useAuctionAccess';
import { AuctionPermissionsModal } from './AuctionPermissionsModal';
import clsx from 'clsx';

export function UserManagement() {
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [permissionsUser, setPermissionsUser] = useState<any | null>(null);
  const [userLogs, setUserLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  const handleViewActivity = async (user: any) => {
    setSelectedUser(user);
    setIsLoadingLogs(true);
    const logs = await adminService.getUserAuditLogs(user.id);
    setUserLogs(logs);
    setIsLoadingLogs(false);
  };

  const loadUsers = async () => {
    setIsLoading(true);
    const data = await adminService.getUsers();
    setUsers(data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!window.confirm(`Are you sure you want to change this user's role to ${newRole.toUpperCase()}?`)) return;

    setUpdatingId(userId);
    const success = await adminService.updateUserRole(userId, newRole);
    if (success) {
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
    }
    setUpdatingId(null);
  };

  const [isResetting, setIsResetting] = useState(false);

  const handleResetAllToMstc = async () => {
    if (!window.confirm('Reset all non-admin users to only have access to MSTC Auctions?')) return;
    setIsResetting(true);
    const success = await adminService.resetAllNonAdminsToMstcOnly();
    if (success) {
      setUsers(users.map(u => (u.role === 'admin' || u.role === 'superadmin') ? u : { ...u, allowed_auction_types: ['mstc'] }));
    }
    setIsResetting(false);
  };

  const handlePermissionsUpdated = (userId: string, updatedAllowedTypes: string[]) => {
    setUsers(users.map(u => u.id === userId ? { ...u, allowed_auction_types: updatedAllowedTypes } : u));
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
      <div className="p-6 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-bold text-slate-900 flex items-center">
          <Users className="w-5 h-5 mr-2 text-primary" /> User Database & Access Permissions
        </h2>
        <button
          type="button"
          onClick={handleResetAllToMstc}
          disabled={isResetting}
          className="text-xs font-bold text-slate-700 hover:text-primary px-3.5 py-2 rounded-xl border border-slate-200 hover:border-primary/40 bg-slate-50 hover:bg-slate-100 transition-all flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
        >
          <ShieldCheck className="w-4 h-4 text-primary" />
          <span>{isResetting ? 'Resetting...' : 'Set All Users to MSTC Only'}</span>
        </button>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
              <th className="px-6 py-4 font-semibold">User Info</th>
              <th className="px-6 py-4 font-semibold">Contact</th>
              <th className="px-6 py-4 font-semibold">Role</th>
              <th className="px-6 py-4 font-semibold">Auction Access</th>
              <th className="px-6 py-4 font-semibold">Plan / Views</th>
              <th className="px-6 py-4 font-semibold">Organization / KYC</th>
              <th className="px-6 py-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((user) => {
              const isAdmin = user.role === 'admin' || user.role === 'superadmin';
              const allowedList: string[] = Array.isArray(user.allowed_auction_types)
                ? user.allowed_auction_types
                : ['mstc'];

              return (
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
                      isAdmin ? "bg-purple-100 text-purple-700" :
                      user.role === 'seller' ? "bg-amber-100 text-amber-700" :
                      user.role === 'logistics' ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                    )}>
                      {user.role}
                    </span>
                  </td>

                  {/* Granular Auction Type Access Badges & Modal trigger */}
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1.5 max-w-[280px]">
                      {isAdmin ? (
                        <span className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-black uppercase rounded-md w-fit">
                          Full Access (Admin)
                        </span>
                      ) : (
                        <>
                          <div className="flex flex-wrap gap-1">
                            {ALL_AUCTION_TYPES.map((type) => {
                              const isGranted = allowedList.includes(type.key);
                              if (!isGranted) return null;
                              return (
                                <span
                                  key={type.key}
                                  className={clsx(
                                    "px-1.5 py-0.5 text-[9px] font-extrabold uppercase rounded border",
                                    type.colorClass
                                  )}
                                  title={type.label}
                                >
                                  {type.shortLabel}
                                </span>
                              );
                            })}
                            {allowedList.length === 0 && (
                              <span className="px-1.5 py-0.5 text-[9px] font-bold text-red-600 bg-red-50 border border-red-200 rounded">
                                No Access Granted
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setPermissionsUser(user)}
                            className="text-[11px] font-bold text-primary hover:text-primary/80 flex items-center gap-1 w-fit cursor-pointer mt-0.5"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Edit Access ({allowedList.length}/{ALL_AUCTION_TYPES.length})</span>
                          </button>
                        </>
                      )}
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => handleViewActivity(user)}
                        className={clsx(
                          "px-2.5 py-1 text-xs font-bold rounded-md uppercase tracking-wide border transition-all cursor-pointer inline-flex items-center gap-1.5 hover:scale-[1.02] w-fit",
                          user.subscription_plan === 'pro' ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100" :
                          user.subscription_plan === 'enterprise' ? "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100" :
                          (user.subscription_plan === 'go' || user.subscription_plan === 'go-subscription') ? "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100" :
                          "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        )}
                      >
                        <span>{(user.subscription_plan === 'go' || user.subscription_plan === 'go-subscription') ? 'individual' : (user.subscription_plan || 'explorer')}</span>
                        <Activity className="w-3 h-3" />
                      </button>
                      {user.subscription_expires_at && (
                        <span className="text-[10px] font-bold text-slate-400 font-mono">
                          Expires: {new Date(user.subscription_expires_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
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
                    {(user.role === 'buyer' || user.role === 'seller' || user.role === 'logistics') && (
                      <div className="inline-flex relative">
                        <select
                          value={user.role}
                          onChange={(e) => handleRoleChange(user.id, e.target.value)}
                          disabled={updatingId === user.id}
                          className="appearance-none pr-8 pl-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-md outline-none cursor-pointer disabled:opacity-50 transition-colors"
                        >
                          <option value="buyer">Buyer</option>
                          <option value="seller">Seller</option>
                          <option value="logistics">Logistics</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                          <svg className="h-3 w-3 fill-current" viewBox="0 0 20 20">
                            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                          </svg>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Permissions Edit Modal */}
      {permissionsUser && (
        <AuctionPermissionsModal
          user={permissionsUser}
          isOpen={!!permissionsUser}
          onClose={() => setPermissionsUser(null)}
          onUpdated={handlePermissionsUpdated}
        />
      )}

      {/* User Activity History Drawer/Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border border-slate-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-sm uppercase tracking-wider">User Activity History</h3>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                    {selectedUser.first_name} {selectedUser.last_name} ({selectedUser.email})
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedUser(null);
                  setUserLogs([]);
                }}
                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {isLoadingLogs ? (
                <div className="flex flex-col items-center py-16 text-slate-500">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-3"></div>
                  <p className="text-xs font-bold uppercase tracking-wider">Loading activity log...</p>
                </div>
              ) : userLogs.length === 0 ? (
                <div className="text-center py-16 text-slate-400 space-y-2">
                  <Activity className="w-8 h-8 mx-auto opacity-40" />
                  <p className="text-sm font-semibold">No recent activity logged for this user.</p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {userLogs.map((log) => {
                    const isViewAuction = log.action === 'view_auction_details';
                    const isLogin = log.action === 'user_login';
                    const isRegister = log.action === 'user_register';
                    const isLogout = log.action === 'user_logout';
                    
                    return (
                      <div key={log.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-3">
                        <div className={clsx(
                          "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                          isViewAuction ? "bg-blue-50 text-blue-600" :
                          isLogin || isRegister ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-600"
                        )}>
                          {isViewAuction ? <Activity className="w-4 h-4" /> :
                           isLogin ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                        </div>
                        <div className="flex-grow">
                          <div className="flex justify-between items-start">
                            <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                              {isViewAuction ? 'Viewed Auction Lot' :
                               isLogin ? 'Signed In' :
                               isRegister ? 'Account Registered' :
                               isLogout ? 'Signed Out' : log.action}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">
                              {new Date(log.created_at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                            </span>
                          </div>
                          
                          {/* Log Specific Details */}
                          {isViewAuction && log.details?.title && (
                            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-600">
                              <span className="font-semibold text-primary">{log.details.reference_number || 'N/A'}</span>
                              <span className="text-slate-300">|</span>
                              <span className="truncate font-medium">{log.details.title}</span>
                            </div>
                          )}

                          {log.ip_address && (
                            <div className="mt-2 text-[10px] text-slate-400 font-mono flex items-center gap-1.5">
                              <span>IP: {log.ip_address}</span>
                              <span>•</span>
                              <span className="truncate max-w-[250px]">{log.details?.userAgent || 'Unknown Agent'}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
