import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { blogService } from '../services/blogService';
import type { Blog as BlogType } from '../types/database.types';
import { format } from 'date-fns';
import { Calendar, User, ArrowLeft } from 'lucide-react';

export function BlogDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [blog, setBlog] = useState<BlogType | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (slug) {
      loadBlog(slug);
    }
  }, [slug]);

  const loadBlog = async (identifier: string) => {
    try {
      const data = await blogService.getBlogBySlugOrId(identifier);
      if (data && data.is_published) {
        setBlog(data);
      } else {
        // If not found or not published, redirect back to blog index
        navigate('/blog');
      }
    } catch (error) {
      console.error('Error loading blog:', error);
      navigate('/blog');
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

  if (!blog) {
    return null;
  }

  return (
    <div className="bg-white min-h-screen pb-20">
      {/* Hero Section */}
      <div className="relative w-full h-[400px] md:h-[500px] bg-slate-900">
        {blog.image_url ? (
          <>
            <img 
              src={blog.image_url} 
              alt={blog.title} 
              className="absolute inset-0 w-full h-full object-cover opacity-60" 
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent"></div>
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary-900 to-slate-900"></div>
        )}
        
        <div className="absolute inset-0 flex flex-col justify-end max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <Link 
            to="/blog" 
            className="inline-flex items-center text-white/80 hover:text-white mb-8 transition-colors w-fit font-medium text-sm bg-black/20 hover:bg-black/40 px-4 py-2 rounded-full backdrop-blur-sm border border-white/10"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to all blogs
          </Link>
          
          <div className="flex flex-wrap items-center gap-4 text-white/80 mb-4 text-sm font-medium">
            <span className="flex items-center"><Calendar className="w-4 h-4 mr-1.5" /> {format(new Date(blog.published_at || blog.created_at), 'MMMM d, yyyy')}</span>
            <span className="flex items-center"><User className="w-4 h-4 mr-1.5" /> {blog.author_name || 'Admin'}</span>
            {blog.is_featured && (
               <span className="bg-primary text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm ml-2">
                 Featured
               </span>
            )}
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white leading-tight drop-shadow-lg">
            {blog.title}
          </h1>
        </div>
      </div>

      {/* Content Section */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="prose prose-lg md:prose-xl mx-auto text-slate-800 prose-img:rounded-2xl prose-img:shadow-lg prose-a:text-primary hover:prose-a:text-primary-600 prose-headings:text-slate-900" 
             dangerouslySetInnerHTML={{ __html: blog.content }} />
      </div>
    </div>
  );
}
