import { useEffect, useState } from 'react';
import { publicService } from '../services/publicService';
import type { Announcement } from '../types/database.types';
import { Bell, Calendar, FileText } from 'lucide-react';

export function Notices() {
  const [notices, setNotices] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadNotices() {
      // Fetch more notices for the dedicated page
      const data = await publicService.getActiveAnnouncements(20);
      setNotices(data);
      setIsLoading(false);
    }
    loadNotices();
  }, []);

  return (
    <div className="bg-slate-50 min-h-screen py-16">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
        <div className="flex items-center space-x-4 mb-10 border-b border-slate-200 pb-6">
          <div className="w-14 h-14 bg-slate-100 rounded-xl flex items-center justify-center">
            <Bell className="w-8 h-8 text-slate-900" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Official Notices</h1>
            <p className="mt-2 text-lg text-slate-600">Platform announcements and official circulars.</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
          </div>
        ) : notices.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
            <p className="text-lg text-slate-500">No official notices available at this time.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <ul className="divide-y divide-slate-200">
              {notices.map((notice) => (
                <li key={notice.id} className="p-6 hover:bg-slate-50 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    <div className="flex-shrink-0 flex items-center sm:items-start pt-1 text-slate-400">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div className="flex-grow">
                      <h2 className="text-xl font-bold text-slate-900 mb-2">{notice.title}</h2>
                      <div className="flex items-center text-sm font-semibold text-slate-900 mb-4">
                        <Calendar className="w-4 h-4 mr-2 text-slate-400" />
                        {new Date(notice.created_at).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                      </div>
                      <div className="prose prose-slate max-w-none text-slate-600">
                        {notice.content.split('\n').map((paragraph, idx) => (
                          <p key={idx} className="mb-2">{paragraph}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
