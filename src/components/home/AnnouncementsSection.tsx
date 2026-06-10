import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, ArrowRight, Calendar } from 'lucide-react';
import { publicService } from '../../services/publicService';
import type { Announcement } from '../../types/database.types';

export function AnnouncementsSection() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchAnnouncements() {
      const data = await publicService.getActiveAnnouncements(4);
      setAnnouncements(data);
      setIsLoading(false);
    }
    fetchAnnouncements();
  }, []);

  return (
    <section className="py-20 bg-slate-50 border-t border-slate-200">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-end mb-12">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl flex items-center">
              <Bell className="w-8 h-8 text-primary mr-3" />
              Latest Announcements
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              Stay informed with official notices, updates, and platform changes.
            </p>
          </div>
          <Link to="/notices" className="hidden sm:flex items-center text-primary font-semibold hover:text-primary-700">
            View All Notices <ArrowRight className="ml-2 w-5 h-5" />
          </Link>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : announcements.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300">
            <p className="text-slate-500">No active announcements at this time.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {announcements.map((announcement) => (
              <div key={announcement.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow flex flex-col">
                <div className="flex items-center text-sm text-slate-500 mb-3">
                  <Calendar className="w-4 h-4 mr-2" />
                  {new Date(announcement.created_at).toLocaleDateString()}
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{announcement.title}</h3>
                <p className="text-slate-600 text-sm line-clamp-3 mb-4 flex-grow">
                  {announcement.content}
                </p>
                <Link to="/notices" className="text-primary font-medium text-sm hover:underline mt-auto inline-flex items-center">
                  Read full notice <ArrowRight className="ml-1 w-4 h-4" />
                </Link>
              </div>
            ))}
          </div>
        )}
        
        <div className="mt-8 sm:hidden flex justify-center">
          <Link to="/notices" className="inline-flex items-center px-6 py-3 border border-slate-300 shadow-sm text-base font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50">
            View All Notices
          </Link>
        </div>
      </div>
    </section>
  );
}
