import { useEffect, useState } from 'react';
import { publicService } from '../services/publicService';
import type { NewsUpdate } from '../types/database.types';
import { Newspaper, Calendar, ArrowRight } from 'lucide-react';

export function News() {
  const [news, setNews] = useState<NewsUpdate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadNews() {
      const data = await publicService.getPublishedNews(20);
      setNews(data);
      setIsLoading(false);
    }
    loadNews();
  }, []);

  return (
    <div className="bg-slate-50 min-h-screen py-16">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
        <div className="flex items-center space-x-4 mb-10 border-b border-slate-200 pb-6">
          <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center">
            <Newspaper className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">News & Updates</h1>
            <p className="mt-2 text-lg text-slate-600">Latest platform features, press releases, and industry news.</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : news.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
            <p className="text-lg text-slate-500">No news updates available at this time.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {news.map((item) => (
              <article key={item.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-xl transition-shadow flex flex-col">
                {item.image_url ? (
                  <img src={item.image_url} alt={item.title} className="w-full h-48 object-cover" />
                ) : (
                  <div className="w-full h-48 bg-slate-200 flex items-center justify-center text-slate-400">
                    <Newspaper className="w-12 h-12 opacity-20" />
                  </div>
                )}
                <div className="p-6 flex-grow flex flex-col">
                  <div className="flex items-center text-sm font-medium text-slate-500 mb-3">
                    <Calendar className="w-4 h-4 mr-2" />
                    {new Date(item.published_at || item.created_at).toLocaleDateString()}
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 mb-3 line-clamp-2">{item.title}</h2>
                  <p className="text-slate-600 text-sm line-clamp-3 mb-6 flex-grow">
                    {item.summary || item.content}
                  </p>
                  <button className="text-primary font-medium text-sm hover:text-primary-700 mt-auto inline-flex items-center group">
                    Read article <ArrowRight className="ml-1 w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
