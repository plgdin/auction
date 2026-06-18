import { useState, useEffect } from 'react';
import { Menu, Bell, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../../store/appStore';
import { useAuthStore } from '../../store/authStore';
import { adminService } from '../../services/adminService';
import type { Notification } from '../../types/database.types';

export function TopBar() {
  const { toggleSidebar } = useAppStore();
  const { user } = useAuthStore();
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  useEffect(() => {
    if (user) {
      adminService.getNotifications(user.id).then(setNotifications);
    }
  }, [user]);

  useEffect(() => {
    if (!isNotifOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.notification-container')) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [isNotifOpen]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const handleMarkRead = async (id: string) => {
    await adminService.markNotificationAsRead(id);
    setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 lg:px-8 shrink-0">
      <button 
        onClick={toggleSidebar}
        className="p-2 -ml-2 rounded-md hover:bg-secondary text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary lg:hidden"
      >
        <Menu size={24} />
      </button>

      <div className="flex items-center space-x-4 ml-auto">
        <div className="relative notification-container">
          <button 
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-secondary transition-colors relative animate-none"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-card"></span>
            )}
          </button>

          {isNotifOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-slate-900">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="text-xs font-bold bg-primary text-white px-2 py-0.5 rounded-full">{unreadCount} New</span>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-slate-500 text-sm">No notifications.</div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {notifications.slice(0, 5).map(notif => (
                      <li 
                        key={notif.id} 
                        className={`p-4 hover:bg-slate-50 transition-colors cursor-pointer ${!notif.is_read ? 'bg-blue-50/50' : ''}`}
                        onClick={() => { if (!notif.is_read) handleMarkRead(notif.id); }}
                      >
                        <div className="flex gap-3">
                          <div className={`mt-0.5 ${!notif.is_read ? 'text-primary' : 'text-slate-400'}`}>
                            {notif.title.toLowerCase().includes('success') || notif.title.toLowerCase().includes('won') ? <CheckCircle2 className="w-4 h-4" /> :
                             notif.title.toLowerCase().includes('alert') || notif.title.toLowerCase().includes('outbid') ? <AlertCircle className="w-4 h-4" /> :
                             <Info className="w-4 h-4" />}
                          </div>
                          <div>
                            <p className={`text-sm ${!notif.is_read ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>{notif.title}</p>
                            <p className="text-xs text-slate-500 mt-1 line-clamp-2">{notif.message}</p>
                            <p className="text-[10px] text-slate-400 mt-2 uppercase font-semibold">{new Date(notif.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="p-2 border-t border-slate-100 bg-slate-50 text-center">
                <Link 
                  to="/dashboard/notifications" 
                  onClick={() => setIsNotifOpen(false)}
                  className="text-xs font-bold text-primary hover:text-primary-700 uppercase tracking-wider"
                >
                  View All Notifications
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
