// @ts-nocheck
import { useEffect, useState } from 'react';
import { Bell, CheckCircle2, AlertCircle, Info, Check } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { adminService } from '../../services/adminService';
import type { Notification } from '../../types/database.types';
import clsx from 'clsx';

export function Notifications() {
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadNotifications() {
      if (!user) return;
      setIsLoading(true);
      const data = await adminService.getNotifications(user.id);
      setNotifications(data);
      setIsLoading(false);
    }
    loadNotifications();
  }, [user]);

  const handleMarkAsRead = async (id: string) => {
    await adminService.markNotificationAsRead(id);
    setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const handleMarkAllAsRead = async () => {
    const unread = notifications.filter(n => !n.is_read);
    for (const notif of unread) {
      await adminService.markNotificationAsRead(notif.id);
    }
    setNotifications(notifications.map(n => ({ ...n, is_read: true })));
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center">
            <Bell className="w-6 h-6 mr-3 text-primary" />
            Notifications
            {unreadCount > 0 && (
              <span className="ml-3 text-xs font-bold bg-primary text-white px-2 py-0.5 rounded-full">
                {unreadCount} New
              </span>
            )}
          </h1>
          <p className="text-slate-500 mt-1">Manage your alerts and account activity.</p>
        </div>
        
        {unreadCount > 0 && (
          <button 
            onClick={handleMarkAllAsRead}
            className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors flex items-center text-sm"
          >
            <Check className="w-4 h-4 mr-2" /> Mark all as read
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-20 bg-slate-50">
            <Bell className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900">You're all caught up!</h3>
            <p className="text-slate-500 mt-1">No new notifications to show.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {notifications.map((notif) => {
              const isAlert = notif.title.toLowerCase().includes('alert') || notif.title.toLowerCase().includes('outbid');
              const isSuccess = notif.title.toLowerCase().includes('success') || notif.title.toLowerCase().includes('won');
              
              return (
                <li 
                  key={notif.id} 
                  className={clsx(
                    "p-6 hover:bg-slate-50 transition-colors",
                    !notif.is_read ? "bg-blue-50/30" : "bg-white"
                  )}
                >
                  <div className="flex gap-4">
                    <div className={clsx(
                      "mt-1 shrink-0",
                      isAlert ? "text-red-500" : isSuccess ? "text-green-500" : "text-primary"
                    )}>
                      {isAlert ? <AlertCircle className="w-6 h-6" /> : isSuccess ? <CheckCircle2 className="w-6 h-6" /> : <Info className="w-6 h-6" />}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex justify-between items-start gap-4">
                        <h3 className={clsx("text-base", !notif.is_read ? "font-bold text-slate-900" : "font-semibold text-slate-700")}>
                          {notif.title}
                        </h3>
                        <span className="text-xs text-slate-400 font-medium whitespace-nowrap">
                          {new Date(notif.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
                        {notif.message}
                      </p>
                      
                      <div className="mt-4 flex gap-3">
                        {!notif.is_read && (
                          <button 
                            onClick={() => handleMarkAsRead(notif.id)}
                            className="text-xs font-bold text-primary hover:text-primary-700 uppercase tracking-wider"
                          >
                            Mark as Read
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
