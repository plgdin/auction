import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, ArrowRight, Calendar } from 'lucide-react';
import { publicService } from '../../services/publicService';
import clsx from 'clsx';

interface NoticeItem {
  id: string;
  title: string;
  content: string;
  date: string;
  type: 'notice' | 'news';
  is_disabled?: boolean;
}

export function AnnouncementsSection() {
  const [items, setItems] = useState<NoticeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [announcementsData, newsData] = await Promise.all([
          publicService.getActiveAnnouncements(8),
          publicService.getPublishedNews(8)
        ]);

        const combinedItems: NoticeItem[] = [
          ...announcementsData.map(a => ({
            id: `notice-${a.id}`,
            title: a.title,
            content: a.content,
            date: a.created_at,
            type: 'notice' as const,
            is_disabled: false
          })),
          ...newsData.slice(0, 3).map(n => ({
            id: `news-${n.id}`,
            title: n.title,
            content: n.summary || n.content || '',
            date: n.published_at || n.created_at,
            type: 'news' as const,
            is_disabled: true
          }))
        ];

        // Sort by date descending
        combinedItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        // Always show in multiples of 4 so it feels filled and not empty
        const countToShow = Math.floor(combinedItems.length / 4) * 4;
        const visibleItems = combinedItems.slice(0, countToShow);

        setItems(visibleItems);
      } catch (error) {
        console.error('Error fetching announcements/news:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <section className="py-20 bg-slate-50 border-t border-slate-200">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-end mb-12">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl flex items-center">
              <Bell className="w-8 h-8 text-slate-900 mr-3" />
              Latest Announcements
            </h2>
            <p className="mt-4 text-lg text-slate-650">
              Stay informed with official notices, updates, and platform changes.
            </p>
          </div>
          <Link to="/notices" className="hidden sm:flex items-center text-slate-900 font-semibold hover:text-black">
            View All Notices <ArrowRight className="ml-2 w-5 h-5" />
          </Link>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300">
            <p className="text-slate-500">No active announcements or news at this time.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {items.map((item) => {
              if (item.type === 'notice') {
                return (
                  <div 
                    key={item.id} 
                    className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow flex flex-col group hover:border-slate-400"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center text-sm text-slate-500">
                        <Calendar className="w-4 h-4 mr-2" />
                        {new Date(item.date).toLocaleDateString()}
                      </div>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                        Announcement
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-slate-700 transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-slate-650 text-sm line-clamp-3 mb-4 flex-grow">
                      {item.content}
                    </p>
                    <Link to="/notices" className="text-slate-900 font-semibold text-sm hover:underline mt-auto inline-flex items-center hover:text-black">
                      Read full notice <ArrowRight className="ml-1 w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </div>
                );
              } else {
                return (
                  <div 
                    key={item.id} 
                    className={clsx(
                      "p-6 rounded-xl border flex flex-col",
                      item.is_disabled
                        ? "bg-slate-100/50 border-slate-200 opacity-60 select-none cursor-not-allowed"
                        : "bg-white border-slate-200 hover:shadow-md hover:border-slate-400 transition-shadow group"
                    )}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center text-sm text-slate-500">
                        <Calendar className="w-4 h-4 mr-2" />
                        {new Date(item.date).toLocaleDateString()}
                      </div>
                      <span className={clsx(
                        "inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold border",
                        item.is_disabled
                          ? "bg-slate-200 text-slate-500 border-slate-300"
                          : "bg-slate-100 text-slate-800 border-slate-200"
                      )}>
                        News {item.is_disabled && '(Disabled)'}
                      </span>
                    </div>
                    <h3 className={clsx(
                      "text-lg font-bold text-slate-900 mb-2 transition-colors",
                      !item.is_disabled && "group-hover:text-slate-700"
                    )}>
                      {item.title}
                    </h3>
                    <p className="text-slate-650 text-sm line-clamp-3 mb-4 flex-grow">
                      {item.content}
                    </p>
                    {!item.is_disabled ? (
                      <Link to="/news" className="text-slate-900 font-semibold text-sm hover:underline mt-auto inline-flex items-center hover:text-black">
                        Read full article <ArrowRight className="ml-1 w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                      </Link>
                    ) : (
                      <span className="text-slate-400 font-semibold text-sm mt-auto inline-flex items-center">
                        Article Unavailable
                      </span>
                    )}
                  </div>
                );
              }
            })}
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
