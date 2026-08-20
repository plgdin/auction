// @ts-nocheck
import { useEffect, useState, useMemo } from 'react';
import {
  Users, CheckCircle2, ShieldAlert, Shield, Globe, Clock, X,
  Activity, Search, Filter, ChevronDown, Save, Ban, UserCheck,
  Crown, CreditCard, Calendar, AlertTriangle, ExternalLink, ShieldCheck, Lock
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { ALL_AUCTION_TYPES } from '../../hooks/useAuctionAccess';
import { AuctionPermissionsModal } from './AuctionPermissionsModal';
import clsx from 'clsx';

// ── Constants ──────────────────────────────────────────────────────────────────

const ROLE_OPTIONS = [
  { value: 'buyer', label: 'Buyer', color: 'bg-blue-100 text-blue-700' },
  { value: 'seller', label: 'Seller', color: 'bg-amber-100 text-amber-700' },
  { value: 'logistics', label: 'Logistics', color: 'bg-emerald-100 text-emerald-700' },
] as const;

const PLAN_OPTIONS = [
  { value: 'explorer', label: 'Explorer (Free)', color: 'bg-slate-100 text-slate-600' },
  { value: 'go', label: 'Individual (Go)', color: 'bg-blue-100 text-blue-700' },
  { value: 'pro', label: 'Business (Pro)', color: 'bg-amber-100 text-amber-700' },
  { value: 'enterprise', label: 'Enterprise', color: 'bg-indigo-100 text-indigo-700' },
] as const;

const ROLE_BADGE_COLORS: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700',
  superadmin: 'bg-purple-100 text-purple-700',
  seller: 'bg-amber-100 text-amber-700',
  logistics: 'bg-emerald-100 text-emerald-700',
  buyer: 'bg-blue-100 text-blue-700',
};

const PLAN_BADGE_COLORS: Record<string, string> = {
  explorer: 'bg-slate-100 text-slate-600',
  go: 'bg-blue-100 text-blue-700',
  'go-subscription': 'bg-blue-100 text-blue-700',
  pro: 'bg-amber-100 text-amber-700',
  enterprise: 'bg-indigo-100 text-indigo-700',
};

function getPlanDisplayName(plan: string | null | undefined): string {
  if (!plan || plan === 'explorer') return 'Explorer';
  if (plan === 'go' || plan === 'go-subscription') return 'Individual';
  if (plan === 'pro') return 'Business';
  if (plan === 'enterprise') return 'Enterprise';
  return plan;
}

// ── Drawer Tabs ────────────────────────────────────────────────────────────────

type DrawerTab = 'access' | 'activity';

// ── Main Component ─────────────────────────────────────────────────────────────

export function UserManagement() {
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Drawer state
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('access');
  const [isSaving, setIsSaving] = useState(false);

  // Editable drawer fields
  const [editRole, setEditRole] = useState('');
  const [editPlan, setEditPlan] = useState('');
  const [editExpiry, setEditExpiry] = useState('');
  const [editActive, setEditActive] = useState(true);

  // Auction Permissions Modal state
  const [permissionsUser, setPermissionsUser] = useState<any | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  // Activity log state
  const [userLogs, setUserLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Confirmation modal
  const [confirmAction, setConfirmAction] = useState<{
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // ── Data Loading ───────────────────────────────────────────────────────────

  const loadUsers = async () => {
    setIsLoading(true);
    const data = await adminService.getUsers();
    setUsers(data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // ── Filtering ──────────────────────────────────────────────────────────────

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      // Search filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const fullName = `${user.first_name || ''} ${user.last_name || ''}`.toLowerCase();
        const email = (user.email || '').toLowerCase();
        if (!fullName.includes(q) && !email.includes(q) && !user.id.toLowerCase().includes(q)) {
          return false;
        }
      }
      // Role filter
      if (roleFilter !== 'all' && user.role !== roleFilter) return false;
      // Plan filter
      if (planFilter !== 'all') {
        const userPlan = user.subscription_plan || 'explorer';
        if (planFilter === 'go' && userPlan !== 'go' && userPlan !== 'go-subscription') return false;
        if (planFilter !== 'go' && userPlan !== planFilter) return false;
      }
      // Status filter
      if (statusFilter === 'active' && user.is_active === false) return false;
      if (statusFilter === 'disabled' && user.is_active !== false) return false;
      return true;
    });
  }, [users, searchQuery, roleFilter, planFilter, statusFilter]);

  // ── Drawer Logic ───────────────────────────────────────────────────────────

  const openDrawer = (user: any) => {
    setSelectedUser(user);
    setDrawerTab('access');
    setEditRole(user.role || 'buyer');
    setEditPlan(user.subscription_plan || 'explorer');
    setEditExpiry(
      user.subscription_expires_at
        ? new Date(user.subscription_expires_at).toISOString().split('T')[0]
        : ''
    );
    setEditActive(user.is_active !== false);
    setUserLogs([]);
  };

  const closeDrawer = () => {
    setSelectedUser(null);
    setConfirmAction(null);
  };

  const loadActivityLogs = async () => {
    if (!selectedUser) return;
    setIsLoadingLogs(true);
    const logs = await adminService.getUserAuditLogs(selectedUser.id);
    setUserLogs(logs);
    setIsLoadingLogs(false);
  };

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

  // Load activity logs when switching to activity tab
  useEffect(() => {
    if (drawerTab === 'activity' && selectedUser && userLogs.length === 0) {
      loadActivityLogs();
    }
  }, [drawerTab, selectedUser]);

  // ── Save Handler ───────────────────────────────────────────────────────────

  const hasChanges = selectedUser && (
    editRole !== (selectedUser.role || 'buyer') ||
    editPlan !== (selectedUser.subscription_plan || 'explorer') ||
    editExpiry !== (selectedUser.subscription_expires_at
      ? new Date(selectedUser.subscription_expires_at).toISOString().split('T')[0]
      : '') ||
    editActive !== (selectedUser.is_active !== false)
  );

  const handleSave = async () => {
    if (!selectedUser || !hasChanges) return;

    // Check for destructive actions
    const isDisabling = editActive === false && selectedUser.is_active !== false;
    const isDowngrading = PLAN_OPTIONS.findIndex(p => p.value === editPlan) <
      PLAN_OPTIONS.findIndex(p => p.value === (selectedUser.subscription_plan || 'explorer'));

    if (isDisabling || isDowngrading) {
      const messages: string[] = [];
      if (isDisabling) messages.push('disable this user\'s account');
      if (isDowngrading) messages.push(`downgrade their plan from ${getPlanDisplayName(selectedUser.subscription_plan)} to ${getPlanDisplayName(editPlan)}`);

      setConfirmAction({
        message: `Are you sure you want to ${messages.join(' and ')}? This will affect the user's access immediately.`,
        onConfirm: () => executeSave(),
      });
      return;
    }

    await executeSave();
  };

  const executeSave = async () => {
    if (!selectedUser) return;
    setConfirmAction(null);
    setIsSaving(true);

    const updates: Record<string, any> = {};

    if (editRole !== (selectedUser.role || 'buyer')) {
      updates.role = editRole;
    }
    if (editPlan !== (selectedUser.subscription_plan || 'explorer')) {
      updates.subscription_plan = editPlan;
    }
    if (editExpiry !== (selectedUser.subscription_expires_at
      ? new Date(selectedUser.subscription_expires_at).toISOString().split('T')[0]
      : '')) {
      updates.subscription_expires_at = editExpiry ? new Date(editExpiry).toISOString() : null;
    }
    if (editActive !== (selectedUser.is_active !== false)) {
      updates.is_active = editActive;
    }

    const success = await adminService.updateUserAccess(selectedUser.id, updates);

    if (success) {
      // Update local state
      setUsers(prev => prev.map(u =>
        u.id === selectedUser.id
          ? { ...u, ...updates }
          : u
      ));
      setSelectedUser((prev: any) => prev ? { ...prev, ...updates } : null);
    }

    setIsSaving(false);
  };

  // ── Loading State ──────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Header & Stats */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center">
              <Users className="w-5 h-5 mr-2 text-primary" /> User Management
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {filteredUsers.length} of {users.length} users shown
            </p>
          </div>

          {/* Quick stats */}
          <div className="flex gap-3 flex-wrap items-center">
            {[
              { label: 'Active', count: users.filter(u => u.is_active !== false).length, color: 'text-emerald-600 bg-emerald-50' },
              { label: 'Disabled', count: users.filter(u => u.is_active === false).length, color: 'text-red-600 bg-red-50' },
              { label: 'Paid', count: users.filter(u => u.subscription_plan && u.subscription_plan !== 'explorer').length, color: 'text-amber-600 bg-amber-50' },
            ].map(stat => (
              <div key={stat.label} className={clsx('px-3 py-1.5 rounded-lg text-xs font-bold', stat.color)}>
                {stat.count} {stat.label}
              </div>
            ))}
            <button
              type="button"
              onClick={handleResetAllToMstc}
              disabled={isResetting}
              className="text-xs font-bold text-slate-700 hover:text-primary px-3.5 py-1.5 rounded-lg border border-slate-200 hover:border-primary/40 bg-slate-50 hover:bg-slate-100 transition-all flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50 ml-2"
            >
              <ShieldCheck className="w-4 h-4 text-primary" />
              <span>{isResetting ? 'Resetting...' : 'Set All Users to MSTC Only'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, email, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
            />
          </div>

          {/* Role Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 font-medium outline-none cursor-pointer appearance-none focus:border-primary transition-all"
            >
              <option value="all">All Roles</option>
              <option value="buyer">Buyer</option>
              <option value="seller">Seller</option>
              <option value="logistics">Logistics</option>
              <option value="admin">Admin</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>

          {/* Plan Filter */}
          <div className="relative">
            <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 font-medium outline-none cursor-pointer appearance-none focus:border-primary transition-all"
            >
              <option value="all">All Plans</option>
              <option value="explorer">Explorer</option>
              <option value="go">Individual</option>
              <option value="pro">Business</option>
              <option value="enterprise">Enterprise</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 font-medium outline-none cursor-pointer appearance-none focus:border-primary transition-all"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* User Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                <th className="px-6 py-4 font-semibold">User</th>
                <th className="px-6 py-4 font-semibold">Contact</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Role</th>
                <th className="px-6 py-4 font-semibold">Auction Access</th>
                <th className="px-6 py-4 font-semibold">Plan</th>
                <th className="px-6 py-4 font-semibold">Last Active</th>
                <th className="px-6 py-4 font-semibold">Organization</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-slate-400">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm font-semibold">No users match your filters.</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    onClick={() => openDrawer(user)}
                    className={clsx(
                      'hover:bg-slate-50 cursor-pointer transition-colors',
                      user.is_active === false && 'opacity-60'
                    )}
                  >
                    {/* User Info */}
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-900">
                        {user.first_name} {user.last_name}
                      </p>
                      <p className="text-xs text-slate-500 font-mono mt-0.5" title={user.id}>
                        {user.id.split('-')[0]}...
                      </p>
                    </td>

                    {/* Contact */}
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-600">{user.email}</p>
                      <p className="text-xs text-slate-500">{user.phone_number || 'N/A'}</p>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      {user.is_active === false ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold rounded-md bg-red-100 text-red-700">
                          <Ban className="w-3 h-3" /> Disabled
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold rounded-md bg-emerald-100 text-emerald-700">
                          <UserCheck className="w-3 h-3" /> Active
                        </span>
                      )}
                    </td>

                    {/* Role */}
                    <td className="px-6 py-4">
                      <span className={clsx(
                        'px-2.5 py-1 text-xs font-bold rounded-md uppercase tracking-wide',
                        ROLE_BADGE_COLORS[user.role] || 'bg-slate-100 text-slate-600'
                      )}>
                        {user.role}
                      </span>
                    </td>

                    {/* Auction Access */}
                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-col gap-1.5 max-w-[200px]">
                        {(user.role === 'admin' || user.role === 'superadmin') ? (
                          <span className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-black uppercase rounded-md w-fit">
                            Full Access (Admin)
                          </span>
                        ) : (
                          <>
                            <div className="flex flex-wrap gap-1">
                              {ALL_AUCTION_TYPES.map((type) => {
                                const allowedList: string[] = Array.isArray(user.allowed_auction_types) ? user.allowed_auction_types : ['mstc'];
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
                              {(!user.allowed_auction_types || user.allowed_auction_types.length === 0) && (
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
                              <span>Edit Access ({Array.isArray(user.allowed_auction_types) ? user.allowed_auction_types.length : 1}/{ALL_AUCTION_TYPES.length})</span>
                            </button>
                          </>
                        )}
                      </div>
                    </td>

                    {/* Plan */}
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className={clsx(
                          'px-2.5 py-1 text-xs font-bold rounded-md uppercase tracking-wide w-fit',
                          PLAN_BADGE_COLORS[user.subscription_plan] || 'bg-slate-100 text-slate-600'
                        )}>
                          {getPlanDisplayName(user.subscription_plan)}
                        </span>
                        {user.subscription_expires_at && (
                          <span className="text-[10px] font-bold text-slate-400 font-mono">
                            Exp: {new Date(user.subscription_expires_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Last Active */}
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5 text-slate-700 font-mono text-xs font-semibold">
                          <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{user.last_ip || 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-1 text-slate-400 text-xs mt-0.5">
                          <Clock className="w-3 h-3 shrink-0" />
                          <span>
                            {user.last_active
                              ? new Date(user.last_active).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
                              : 'Never active'}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Organization */}
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
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── User Detail Drawer ──────────────────────────────────────────────── */}
      {selectedUser && (
        <div
          className="fixed inset-0 z-[1000] flex justify-end bg-slate-950/60 backdrop-blur-xs animate-fade-in"
          onClick={(e) => { if (e.target === e.currentTarget) closeDrawer(); }}
        >
          <div className="bg-white w-full max-w-lg shadow-2xl flex flex-col h-full animate-slide-in-right">
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-black text-slate-900 text-sm uppercase tracking-wider truncate">
                    {selectedUser.first_name} {selectedUser.last_name}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5 truncate">
                    {selectedUser.email}
                  </p>
                </div>
              </div>
              <button
                onClick={closeDrawer}
                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Tabs */}
            <div className="flex border-b border-slate-100 shrink-0">
              {(['access', 'activity'] as DrawerTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setDrawerTab(tab)}
                  className={clsx(
                    'flex-1 px-4 py-3 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer',
                    drawerTab === tab
                      ? 'text-primary border-b-2 border-primary bg-primary/5'
                      : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                  )}
                >
                  {tab === 'access' ? '🔐 Access Control' : '📊 Activity Log'}
                </button>
              ))}
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {drawerTab === 'access' ? (
                <AccessControlTab
                  user={selectedUser}
                  editRole={editRole}
                  setEditRole={setEditRole}
                  editPlan={editPlan}
                  setEditPlan={setEditPlan}
                  editExpiry={editExpiry}
                  setEditExpiry={setEditExpiry}
                  editActive={editActive}
                  setEditActive={setEditActive}
                />
              ) : (
                <ActivityLogTab
                  userLogs={userLogs}
                  isLoadingLogs={isLoadingLogs}
                />
              )}
            </div>

            {/* Drawer Footer (only for Access tab) */}
            {drawerTab === 'access' && (
              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 shrink-0">
                <button
                  onClick={handleSave}
                  disabled={!hasChanges || isSaving}
                  className={clsx(
                    'w-full py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2',
                    hasChanges
                      ? 'bg-primary text-white hover:bg-primary/90 cursor-pointer shadow-lg shadow-primary/20'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  )}
                >
                  {isSaving ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {isSaving ? 'Saving...' : hasChanges ? 'Save Changes' : 'No Changes'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Confirmation Modal ──────────────────────────────────────────────── */}
      {confirmAction && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4 border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-900 text-sm">Confirm Action</h4>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">{confirmAction.message}</p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setConfirmAction(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmAction.onConfirm}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-700 transition-colors cursor-pointer"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permissions Edit Modal */}
      {permissionsUser && (
        <AuctionPermissionsModal
          user={permissionsUser}
          isOpen={!!permissionsUser}
          onClose={() => setPermissionsUser(null)}
          onUpdated={handlePermissionsUpdated}
        />
      )}
    </div>
  );
}

// ── Access Control Tab ─────────────────────────────────────────────────────────

function AccessControlTab({
  user,
  editRole, setEditRole,
  editPlan, setEditPlan,
  editExpiry, setEditExpiry,
  editActive, setEditActive,
}: {
  user: any;
  editRole: string;
  setEditRole: (v: string) => void;
  editPlan: string;
  setEditPlan: (v: string) => void;
  editExpiry: string;
  setEditExpiry: (v: string) => void;
  editActive: boolean;
  setEditActive: (v: boolean) => void;
}) {
  const isAdminOrSuperadmin = user.role === 'admin' || user.role === 'superadmin';

  return (
    <div className="space-y-6">
      {/* User Info Card */}
      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary font-black text-lg">
            {(user.first_name || '?')[0]}{(user.last_name || '?')[0]}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-slate-900 text-sm">{user.first_name} {user.last_name}</p>
            <p className="text-xs text-slate-500 truncate">{user.email}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200/60">
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">User ID</p>
            <p className="text-xs text-slate-700 font-mono mt-0.5 truncate" title={user.id}>{user.id}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Joined</p>
            <p className="text-xs text-slate-700 font-mono mt-0.5">
              {new Date(user.created_at).toLocaleDateString()}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Last IP</p>
            <p className="text-xs text-slate-700 font-mono mt-0.5">{user.last_ip || 'N/A'}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Phone</p>
            <p className="text-xs text-slate-700 font-mono mt-0.5">{user.phone_number || 'N/A'}</p>
          </div>
        </div>
      </div>

      {/* Admin notice */}
      {isAdminOrSuperadmin && (
        <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl flex items-start gap-2.5">
          <Crown className="w-4 h-4 text-purple-600 mt-0.5 shrink-0" />
          <p className="text-xs text-purple-700 font-semibold leading-relaxed">
            This user has <span className="font-black uppercase">{user.role}</span> privileges. Role cannot be changed from the UI.
          </p>
        </div>
      )}

      {/* Role */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5" /> Role
        </label>
        {isAdminOrSuperadmin ? (
          <div className={clsx(
            'px-4 py-3 rounded-xl text-sm font-bold border',
            ROLE_BADGE_COLORS[user.role] || 'bg-slate-100 text-slate-600',
            'border-slate-200'
          )}>
            {user.role.toUpperCase()} (Protected)
          </div>
        ) : (
          <div className="relative">
            <select
              value={editRole}
              onChange={(e) => setEditRole(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none cursor-pointer appearance-none hover:border-primary/40 focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
            >
              {ROLE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        )}
      </div>

      {/* Subscription Plan */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          <CreditCard className="w-3.5 h-3.5" /> Subscription Plan
        </label>
        <div className="relative">
          <select
            value={editPlan}
            onChange={(e) => setEditPlan(e.target.value)}
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none cursor-pointer appearance-none hover:border-primary/40 focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
          >
            {PLAN_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Subscription Expiry */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5" /> Subscription Expiry
        </label>
        <div className="flex gap-2">
          <input
            type="date"
            value={editExpiry}
            onChange={(e) => setEditExpiry(e.target.value)}
            className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none hover:border-primary/40 focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
          />
          {editExpiry && (
            <button
              onClick={() => setEditExpiry('')}
              className="px-3 py-3 bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-500 rounded-xl transition-all cursor-pointer"
              title="Clear expiry date"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <p className="text-[10px] text-slate-400 font-medium">
          Leave empty for no expiration. Setting a past date will revoke access.
        </p>
      </div>

      {/* Account Status Toggle */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          <UserCheck className="w-3.5 h-3.5" /> Account Status
        </label>
        <button
          onClick={() => setEditActive(!editActive)}
          className={clsx(
            'w-full px-4 py-3 rounded-xl text-sm font-bold border-2 transition-all flex items-center justify-between cursor-pointer',
            editActive
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
              : 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
          )}
        >
          <span className="flex items-center gap-2">
            {editActive ? <UserCheck className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
            {editActive ? 'Account Active' : 'Account Disabled'}
          </span>
          <div className={clsx(
            'w-10 h-6 rounded-full relative transition-all',
            editActive ? 'bg-emerald-500' : 'bg-red-400'
          )}>
            <div className={clsx(
              'absolute w-4 h-4 bg-white rounded-full top-1 transition-all shadow-sm',
              editActive ? 'right-1' : 'left-1'
            )} />
          </div>
        </button>
        <p className="text-[10px] text-slate-400 font-medium">
          Disabled accounts cannot log in or access any features.
        </p>
      </div>
    </div>
  );
}

// ── Activity Log Tab ───────────────────────────────────────────────────────────

function ActivityLogTab({
  userLogs,
  isLoadingLogs,
}: {
  userLogs: any[];
  isLoadingLogs: boolean;
}) {
  if (isLoadingLogs) {
    return (
      <div className="flex flex-col items-center py-16 text-slate-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-3" />
        <p className="text-xs font-bold uppercase tracking-wider">Loading activity log...</p>
      </div>
    );
  }

  if (userLogs.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400 space-y-2">
        <Activity className="w-8 h-8 mx-auto opacity-40" />
        <p className="text-sm font-semibold">No recent activity logged for this user.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      {userLogs.map((log) => {
        const isViewAuction = log.action === 'view_auction_details';
        const isLogin = log.action === 'user_login';
        const isRegister = log.action === 'user_register';
        const isLogout = log.action === 'user_logout';

        return (
          <div key={log.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-3">
            <div className={clsx(
              'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
              isViewAuction ? 'bg-blue-50 text-blue-600' :
                isLogin || isRegister ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600'
            )}>
              {isViewAuction ? <Activity className="w-4 h-4" /> :
                isLogin ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
            </div>
            <div className="flex-grow min-w-0">
              <div className="flex justify-between items-start gap-2">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  {isViewAuction ? 'Viewed Auction Lot' :
                    isLogin ? 'Signed In' :
                      isRegister ? 'Account Registered' :
                        isLogout ? 'Signed Out' : log.action}
                </span>
                <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">
                  {new Date(log.created_at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                </span>
              </div>

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
  );
}
