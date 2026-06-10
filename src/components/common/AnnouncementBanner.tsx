import { useEffect, useState } from 'react';
import { Megaphone, X } from 'lucide-react';
import { adminService } from '../../services/adminService';
import type { Announcement } from '../../types/database.types';
import clsx from 'clsx';

export function AnnouncementBanner() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    async function fetchLatestAnnouncement() {
      const announcements = await adminService.getActiveAnnouncements();
      if (announcements.length > 0) {
        const latest = announcements[0];
        
        // Check if user has already dismissed this specific announcement
        const dismissedStr = localStorage.getItem('dismissed_announcements') || '[]';
        const dismissedIds: string[] = JSON.parse(dismissedStr);
        
        if (!dismissedIds.includes(latest.id)) {
          setAnnouncement(latest);
          setIsVisible(true);
        }
      }
    }
    fetchLatestAnnouncement();
  }, []);

  const handleDismiss = () => {
    if (!announcement) return;
    
    // Save to local storage
    const dismissedStr = localStorage.getItem('dismissed_announcements') || '[]';
    const dismissedIds: string[] = JSON.parse(dismissedStr);
    dismissedIds.push(announcement.id);
    localStorage.setItem('dismissed_announcements', JSON.stringify(dismissedIds));
    
    setIsVisible(false);
  };

  if (!isVisible || !announcement) return null;

  // We determine styling by checking the text since priority isn't strictly in our typed interface
  const isUrgent = announcement.title.toLowerCase().includes('urgent') || announcement.content.toLowerCase().includes('urgent');
  const isWarning = announcement.title.toLowerCase().includes('maintenance') || announcement.title.toLowerCase().includes('warning');

  return (
    <div className={clsx(
      "relative px-4 py-3 text-white flex items-center justify-center sm:px-6 lg:px-8",
      isUrgent ? "bg-red-600" : isWarning ? "bg-orange-600" : "bg-primary-600"
    )}>
      <div className="flex items-center gap-2 text-sm font-medium pr-8 max-w-7xl mx-auto w-full text-center">
        <Megaphone className="w-4 h-4 shrink-0 inline" />
        <span className="truncate flex-1">
          <strong className="mr-2">{announcement.title}:</strong>
          {announcement.content}
        </span>
      </div>
      <button 
        onClick={handleDismiss}
        className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-white/20 rounded-md transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
