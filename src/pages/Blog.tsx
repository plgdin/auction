import { useEffect, useState } from 'react';
import { blogService } from '../services/blogService';
import type { Blog as BlogType } from '../types/database.types';
import { format } from 'date-fns';
import { Sparkles, Calendar, User, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Blog() {
  const [blogs, setBlogs] = useState<BlogType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);

  const featuredBlogs = blogs.filter(b => b.is_featured);
  const remainingBlogs = blogs.filter(b => !b.is_featured);

  useEffect(() => {
    if (featuredBlogs.length > 1) {
      const timer = setInterval(() => {
        setCurrentSlide(prev => (prev + 1) % featuredBlogs.length);
      }, 5000);
      return () => clearInterval(timer);
    }
  }, [featuredBlogs.length]);

  useEffect(() => {
    loadBlogs();
  }, []);

  const loadBlogs = async () => {
    try {
      // Only fetch published blogs for the public page
      const data = await blogService.getBlogs(true);
      setBlogs(data);
    } catch (error) {
      console.error('Error loading blogs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (blogs.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 min-h-[60vh] flex flex-col items-center justify-center text-center">
        <Sparkles className="w-16 h-16 text-slate-300 mb-4" />
        <h2 className="text-2xl font-bold text-slate-900 mb-2">No blogs found</h2>
        <p className="text-slate-500">Check back later for interesting updates and stories.</p>
      </div>
    );
  }

  // Handle single blog case
  if (blogs.length === 1) {
    const blog = blogs[0];
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-2xl overflow-hidden shadow-xl border border-slate-100 flex flex-col items-center">
          {blog.image_url && (
            <img src={blog.image_url} alt={blog.title} className="w-full h-[400px] object-cover" />
          )}
          <div className="p-8 md:p-12 w-full text-center">
            <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-6 leading-tight">{blog.title}</h1>
            <div className="flex items-center justify-center gap-6 text-slate-500 mb-10 text-sm font-medium">
              <span className="flex items-center"><Calendar className="w-4 h-4 mr-2" /> {format(new Date(blog.published_at || blog.created_at), 'MMMM d, yyyy')}</span>
              <span className="flex items-center"><User className="w-4 h-4 mr-2" /> {blog.author_name || 'Admin'}</span>
            </div>
            <div className="prose prose-lg mx-auto text-left prose-slate prose-img:rounded-xl prose-a:text-primary line-clamp-6" dangerouslySetInnerHTML={{ __html: blog.content }} />
            <Link to={`/blog/${blog.id}`} className="mt-8 inline-flex items-center px-6 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary-600 transition-colors">
              Read Full Article <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Logic moved to top of component to respect rules of Hooks

  const nextSlide = (e: React.MouseEvent) => {
    e.preventDefault();
    setCurrentSlide(prev => (prev + 1) % featuredBlogs.length);
  };

  const prevSlide = (e: React.MouseEvent) => {
    e.preventDefault();
    setCurrentSlide(prev => (prev - 1 + featuredBlogs.length) % featuredBlogs.length);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
      
      {/* Featured Blogs Slideshow */}
      {featuredBlogs.length > 0 && (
        <div className="relative group/slider">
          {featuredBlogs.map((topBlog, index) => (
            <div 
              key={topBlog.id}
              className={`transition-opacity duration-500 ${index === currentSlide ? 'opacity-100 relative z-10' : 'opacity-0 absolute inset-0 z-0 pointer-events-none'}`}
            >
              <Link to={`/blog/${topBlog.id}`} className="block group">
                <div className="bg-white rounded-3xl overflow-hidden shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col md:flex-row transition-transform duration-300 hover:shadow-2xl hover:-translate-y-1 h-full">
                  {topBlog.image_url && (
                    <div className="md:w-1/2 relative overflow-hidden h-[300px] md:h-auto">
                      <img src={topBlog.image_url} alt={topBlog.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                      <div className="absolute top-4 left-4 bg-primary text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-md">
                        Featured
                      </div>
                    </div>
                  )}
                  <div className={`p-8 md:p-12 flex flex-col justify-center ${topBlog.image_url ? 'md:w-1/2' : 'w-full text-center'}`}>
                    <div className="flex items-center gap-4 text-slate-500 mb-4 text-sm font-medium">
                      <span className="flex items-center"><Calendar className="w-4 h-4 mr-1.5 text-primary" /> {format(new Date(topBlog.published_at || topBlog.created_at), 'MMM d, yyyy')}</span>
                      <span className="flex items-center"><User className="w-4 h-4 mr-1.5 text-primary" /> {topBlog.author_name || 'Admin'}</span>
                    </div>
                    <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-6 leading-tight group-hover:text-primary transition-colors">
                      {topBlog.title}
                    </h2>
                    <div className="text-slate-600 line-clamp-3 mb-8 prose" dangerouslySetInnerHTML={{ __html: topBlog.content }} />
                    
                    <div className="mt-auto flex items-center text-primary font-semibold group-hover:text-primary-600 transition-colors">
                      Read Article <ArrowRight className="w-4 h-4 ml-1.5 transform group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          ))}

          {/* Navigation Arrows */}
          {featuredBlogs.length > 1 && (
            <>
              <button 
                onClick={prevSlide}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-20 bg-white/80 hover:bg-white text-slate-800 p-2 rounded-full shadow-lg opacity-0 group-hover/slider:opacity-100 transition-opacity focus:outline-none"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button 
                onClick={nextSlide}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-20 bg-white/80 hover:bg-white text-slate-800 p-2 rounded-full shadow-lg opacity-0 group-hover/slider:opacity-100 transition-opacity focus:outline-none"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
              
              {/* Dots */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-2">
                {featuredBlogs.map((_, idx) => (
                  <button 
                    key={idx}
                    onClick={() => setCurrentSlide(idx)}
                    className={`w-2 h-2 rounded-full transition-all ${idx === currentSlide ? 'bg-primary w-6' : 'bg-slate-300 hover:bg-slate-400'}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Grid for remaining blogs */}
      {remainingBlogs.length > 0 && (
        <div>
          <h3 className="text-2xl font-bold text-slate-900 mb-8 border-b border-slate-200 pb-4">Latest Articles</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {remainingBlogs.map(blog => (
              <Link to={`/blog/${blog.id}`} key={blog.id} className="bg-white rounded-2xl overflow-hidden shadow-md border border-slate-100 flex flex-col transition-all duration-300 hover:shadow-xl hover:-translate-y-1 group">
                {blog.image_url && (
                  <div className="relative h-48 overflow-hidden">
                     <img src={blog.image_url} alt={blog.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  </div>
                )}
                <div className="p-6 flex flex-col flex-grow">
                  <div className="flex justify-between items-center text-xs text-slate-500 font-medium mb-3">
                    <span className="flex items-center"><Calendar className="w-3.5 h-3.5 mr-1" /> {format(new Date(blog.published_at || blog.created_at), 'MMM d, yyyy')}</span>
                    <span className="flex items-center"><User className="w-3.5 h-3.5 mr-1" /> {blog.author_name || 'Admin'}</span>
                  </div>
                  <h4 className="text-xl font-bold text-slate-900 mb-4 leading-tight group-hover:text-primary transition-colors">{blog.title}</h4>
                  <div className="prose prose-sm text-slate-600 mb-6 flex-grow line-clamp-3" dangerouslySetInnerHTML={{ __html: blog.content }} />
                  
                  <div className="mt-auto flex items-center text-primary font-semibold group-hover:text-primary-600 transition-colors text-sm">
                    Read More <ArrowRight className="w-4 h-4 ml-1 transform group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
