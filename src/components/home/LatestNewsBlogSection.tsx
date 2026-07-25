import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Newspaper, BookOpen, Calendar, ArrowRight, Clock } from 'lucide-react';
import { blogService } from '../../services/blogService';
import { adminService } from '../../services/adminService';
import type { Blog, NewsUpdate } from '../../types/database.types';

/** Strip HTML tags and collapse whitespace from rich-text content */
function stripHtml(html: string | undefined | null): string {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
}

/** Extract accurate news source name from item or title */
function extractNewsSource(item: any): string {
  if (item.source && !['Lelam Bureau', 'Lelam Market Bureau', 'Regulatory Alert'].includes(item.source)) {
    return item.source;
  }
  if (item.title && item.title.includes(' - ')) {
    const parts = item.title.split(' - ');
    const potentialSource = parts[parts.length - 1].trim();
    if (potentialSource && potentialSource.length > 1 && potentialSource.length < 35) {
      return potentialSource;
    }
  }
  return item.source || 'Market Bureau';
}

const DEFAULT_BLOG_IMAGES = [
  'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?auto=format&fit=crop&w=600&q=80',
];

const DEFAULT_NEWS_IMAGES = [
  'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80',
];

export function LatestNewsBlogSection() {
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [news, setNews] = useState<NewsUpdate[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        const [blogData, newsData] = await Promise.all([
          blogService.getBlogs(true).catch(() => []),
          adminService.getNewsUpdates().catch(() => [])
        ]);
        setBlogs(blogData.slice(0, 2));
        setNews(newsData.slice(0, 2));
      } catch (err) {
        console.error('Error loading news and blogs for home section:', err);
      }
    }
    loadData();
  }, []);

  // Fallback items if database is empty or loading
  const displayBlogs = blogs.length > 0 ? blogs : [
    {
      id: 'b1',
      title: 'Navigating MSTC Government Auctions: A Buyer\'s Guide',
      excerpt: 'Learn essential strategies, pre-bid requirements, and document compliance tips for winning MSTC eAuctions.',
      slug: 'navigating-mstc-government-auctions',
      created_at: new Date().toISOString(),
      category: 'Guide',
      read_time: '5 min read',
      image_url: DEFAULT_BLOG_IMAGES[0]
    },
    {
      id: 'b2',
      title: 'Understanding Metal & Scrap Commodity Price Trends',
      excerpt: 'How real-time exchange rates and global metal indices impact auction valuations for industrial scrap.',
      slug: 'metal-scrap-price-trends',
      created_at: new Date().toISOString(),
      category: 'Market Insights',
      read_time: '4 min read',
      image_url: DEFAULT_BLOG_IMAGES[1]
    }
  ];

  const displayNews = news.length > 0 ? news : [
    {
      id: 'n1',
      title: 'India: OMC releases largely stable base prices for upcoming iron ore auction - BigMint',
      summary: 'India: OMC releases largely stable base prices for upcoming iron ore auction BigMint...',
      source: 'BigMint',
      published_at: new Date().toISOString(),
      category: 'News Alert',
      image_url: DEFAULT_NEWS_IMAGES[0]
    },
    {
      id: 'n2',
      title: 'Government land auction in Hyderabad raises serious questions on title and locus standi - The South First',
      summary: 'Government land auction in Hyderabad raises serious questions on title and locus standi The South First...',
      source: 'The South First',
      published_at: new Date().toISOString(),
      category: 'News Alert',
      image_url: DEFAULT_NEWS_IMAGES[1]
    }
  ];

  return (
    <section className="py-16 sm:py-24 bg-white border-t border-slate-200/60 relative">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 relative z-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 sm:mb-16 gap-6">
          <div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight">
              News & Market Intelligence
            </h2>
            <p className="mt-3 sm:mt-4 text-sm sm:text-base lg:text-lg text-slate-600 max-w-2xl leading-relaxed">
              Stay informed with industry updates, auction regulatory changes, and procurement guides.
            </p>
          </div>

          <div className="flex items-center gap-4 shrink-0 pt-2 sm:pt-0">
            <Link
              to="/blog"
              className="inline-flex items-center text-xs sm:text-sm font-bold text-slate-700 hover:text-primary transition-colors"
            >
              View All Blogs <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
            <span className="text-slate-300">|</span>
            <Link
              to="/news"
              className="inline-flex items-center text-xs sm:text-sm font-bold text-slate-700 hover:text-primary transition-colors"
            >
              View All News <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 items-start">
          {/* Featured Blog Posts */}
          <div className="space-y-4 sm:space-y-6">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="w-5 h-5 text-primary" />
              <h3 className="text-lg sm:text-xl font-bold text-slate-900">Featured Blog Articles</h3>
            </div>

            <div className="space-y-4">
              {displayBlogs.map((post: any, idx: number) => {
                const img = post.image_url || DEFAULT_BLOG_IMAGES[idx % DEFAULT_BLOG_IMAGES.length];
                return (
                  <Link
                    key={post.id}
                    to={`/blog/${post.slug || post.id}`}
                    className="block bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs hover:shadow-xl hover:border-primary/40 transition-all duration-300 group"
                  >
                    <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 items-stretch">
                      <div className="w-full h-44 sm:w-36 md:w-40 sm:h-auto shrink-0 rounded-xl overflow-hidden bg-slate-100 relative border border-slate-200/60">
                        <img
                          src={img}
                          alt={post.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>

                      <div className="flex-grow flex flex-col justify-between pt-1 sm:pt-0">
                        <div>
                          <div className="flex items-center gap-3 text-xs font-bold text-primary mb-2">
                            <span className="px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20">
                              {post.category || 'Article'}
                            </span>
                            <span className="text-slate-400 flex items-center gap-1 font-normal">
                              <Clock className="w-3.5 h-3.5" />
                              {post.read_time || '4 min read'}
                            </span>
                          </div>

                          <h4 className="text-base sm:text-lg font-bold text-slate-900 mb-2 group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                            {post.title}
                          </h4>

                          <p className="text-xs sm:text-sm text-slate-500 line-clamp-2 leading-relaxed mb-3">
                            {stripHtml(post.excerpt) || stripHtml(post.content)?.slice(0, 120)}
                          </p>
                        </div>

                        <div className="flex items-center text-xs font-bold text-primary group-hover:translate-x-1 transition-transform pt-2 border-t border-slate-100">
                          <span>Read Full Article</span>
                          <ArrowRight className="w-4 h-4 ml-1.5" />
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Market News & Bulletins */}
          <div className="space-y-4 sm:space-y-6">
            <div className="flex items-center gap-2 mb-2">
              <Newspaper className="w-5 h-5 text-primary" />
              <h3 className="text-lg sm:text-xl font-bold text-slate-900">Latest Market Bulletins</h3>
            </div>

            <div className="space-y-4">
              {displayNews.map((item: any, idx: number) => {
                const img = item.image_url || DEFAULT_NEWS_IMAGES[idx % DEFAULT_NEWS_IMAGES.length];
                const sourceName = extractNewsSource(item);

                return (
                  <Link
                    key={item.id}
                    to="/news"
                    className="block bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs hover:shadow-xl hover:border-primary/40 transition-all duration-300 group"
                  >
                    <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 items-stretch">
                      <div className="w-full h-44 sm:w-36 md:w-40 sm:h-auto shrink-0 rounded-xl overflow-hidden bg-slate-100 relative border border-slate-200/60">
                        <img
                          src={img}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>

                      <div className="flex-grow flex flex-col justify-between pt-1 sm:pt-0">
                        <div>
                          <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-2">
                            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 border border-amber-500/20">
                              {item.category || 'News Alert'}
                            </span>
                            <span className="flex items-center gap-1 font-normal text-slate-400">
                              <Calendar className="w-3.5 h-3.5" />
                              {new Date(item.published_at || item.created_at || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          </div>

                          <h4 className="text-base sm:text-lg font-bold text-slate-900 mb-2 group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                            {item.title}
                          </h4>

                          <p className="text-xs sm:text-sm text-slate-500 line-clamp-2 leading-relaxed mb-3">
                            {stripHtml(item.summary) || stripHtml(item.content)?.slice(0, 120)}
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                          <span className="text-slate-400 font-medium truncate max-w-[180px]">Source: {sourceName}</span>
                          <span className="font-bold text-primary group-hover:translate-x-1 transition-transform flex items-center shrink-0">
                            View News <ArrowRight className="w-3.5 h-3.5 ml-1" />
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
