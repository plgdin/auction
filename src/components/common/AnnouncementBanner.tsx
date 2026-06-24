import { useEffect, useState } from 'react';
import { Megaphone, X } from 'lucide-react';
import type { Announcement } from '../../types/database.types';
import clsx from 'clsx';

export function AnnouncementBanner() {
  // Start with `checked: false` — once the async fetch is done we know whether to show or hide
  const [state, setState] = useState<{ checked: boolean; announcement: Announcement | null; visible: boolean }>({
    checked: false,
    announcement: null,
    visible: false,
  });

  useEffect(() => {
    // Check localStorage first (sync, instant) to decide immediately
    const dismissedStr = localStorage.getItem('dismissed_announcements') || '[]';
    const dismissedIds: string[] = JSON.parse(dismissedStr);

    async function fetchLatestAnnouncement() {
      try {
        // Dynamic import to avoid pulling admin service code into initial bundle
        const { adminService } = await import('../../services/adminService');
        const announcements = await adminService.getActiveAnnouncements();
        if (announcements.length > 0) {
          const latest = announcements[0];
          if (!dismissedIds.includes(latest.id)) {
            setState({ checked: true, announcement: latest, visible: true });
            return;
          }
        }
      } catch {
        // silent
      }
      setState({ checked: true, announcement: null, visible: false });
    }
    fetchLatestAnnouncement();
  }, []);

  const handleDismiss = () => {
    if (!state.announcement) return;
    const dismissedStr = localStorage.getItem('dismissed_announcements') || '[]';
    const dismissedIds: string[] = JSON.parse(dismissedStr);
    dismissedIds.push(state.announcement.id);
    localStorage.setItem('dismissed_announcements', JSON.stringify(dismissedIds));
    setState(s => ({ ...s, visible: false }));
  };

  // Not yet checked → render nothing (no CLS because height starts at 0 and stays 0 if no banner)
  if (!state.checked || !state.visible || !state.announcement) return null;

  const { announcement } = state;
  const isUrgent = announcement.title.toLowerCase().includes('urgent') || announcement.content.toLowerCase().includes('urgent');
  const isWarning = announcement.title.toLowerCase().includes('maintenance') || announcement.title.toLowerCase().includes('warning');

  return (
    <div className={clsx(
      'relative px-4 py-3 text-white flex items-center justify-center sm:px-6 lg:px-8 print:hidden',
      isUrgent ? 'bg-red-600' : isWarning ? 'bg-orange-600' : 'bg-primary-600'
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
