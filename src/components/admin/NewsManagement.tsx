import { useState, useEffect } from 'react';
import { adminService } from '../../services/adminService';
import { newsAggregatorService } from '../../services/newsAggregatorService';
import type { NewsUpdate } from '../../types/database.types';
import { Newspaper, Edit2, Trash2, Plus, RefreshCw, Image as ImageIcon, CheckCircle, XCircle } from 'lucide-react';
import clsx from 'clsx';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const newsSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  summary: z.string().optional(),
  content: z.string().min(10, "Content must be at least 10 characters"),
  image_url: z.string().url("Must be a valid URL").or(z.literal('')).optional(),
});

type NewsFormValues = z.infer<typeof newsSchema>;

export function NewsManagement() {
  const [newsList, setNewsList] = useState<NewsUpdate[]>([]);
  const [activeTab, setActiveTab] = useState<'drafts' | 'published'>('drafts');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<NewsFormValues>({
    resolver: zodResolver(newsSchema)
  });

  const loadNews = async () => {
    const data = await adminService.getAllNewsAdmin();
    setNewsList(data);
  };

  useEffect(() => {
    loadNews();
  }, []);

  const drafts = newsList.filter(n => !n.is_published);
  const published = newsList.filter(n => n.is_published);

  const displayedNews = activeTab === 'drafts' ? drafts : published;

  const handleSyncNews = async () => {
    setIsSyncing(true);
    setSyncMessage('');
    const res = await newsAggregatorService.fetchAndSaveLatestNews();
    setSyncMessage(res.message);
    if (res.success) {
      await loadNews();
      setActiveTab('drafts');
    }
    setIsSyncing(false);
    setTimeout(() => setSyncMessage(''), 5000);
  };

  const handleOpenModal = (news?: NewsUpdate) => {
    if (news) {
      setEditingId(news.id);
      setValue('title', news.title);
      setValue('summary', news.summary || '');
      setValue('content', news.content);
      setValue('image_url', news.image_url || '');
    } else {
      setEditingId(null);
      reset({ title: '', summary: '', content: '', image_url: '' });
    }
    setIsModalOpen(true);
  };

  const onSubmitForm = async (data: NewsFormValues) => {
    
    if (editingId) {
      await adminService.updateNews(editingId, { ...data });
    } else {
      await adminService.createNews({ ...data, is_published: false });
    }
    setIsModalOpen(false);
    await loadNews();
  };

  const togglePublishStatus = async (news: NewsUpdate) => {
    const newStatus = !news.is_published;
    await adminService.updateNews(news.id, { is_published: newStatus });
    await loadNews();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this news item?')) {
      await adminService.deleteNews(id);
      await loadNews();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center">
            <Newspaper className="w-6 h-6 mr-2 text-primary" />
            News & Media Manager
          </h2>
          <p className="text-sm text-slate-500 mt-1">Review auto-fetched drafts and manage live news.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleSyncNews}
            disabled={isSyncing}
            className="flex items-center px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw className={clsx("w-4 h-4 mr-2", isSyncing && "animate-spin")} />
            {isSyncing ? 'Fetching...' : 'Sync Latest News'}
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center px-4 py-2 bg-primary text-white hover:bg-primary-600 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Manual Entry
          </button>
        </div>
      </div>

      {syncMessage && (
        <div className={clsx("p-4 rounded-lg text-sm font-medium", syncMessage.includes('error') ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700")}>
          {syncMessage}
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab('drafts')}
            className={clsx(
              "flex-1 py-4 text-sm font-bold border-b-2 transition-colors",
              activeTab === 'drafts' ? "border-primary text-primary bg-primary/5" : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            )}
          >
            Drafts Inbox ({drafts.length})
          </button>
          <button
            onClick={() => setActiveTab('published')}
            className={clsx(
              "flex-1 py-4 text-sm font-bold border-b-2 transition-colors",
              activeTab === 'published' ? "border-emerald-500 text-emerald-600 bg-emerald-50" : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            )}
          >
            Live Published News ({published.length})
          </button>
        </div>

        {/* List */}
        <div className="divide-y divide-slate-100">
          {displayedNews.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              No {activeTab} news found.
            </div>
          ) : (
            displayedNews.map((news) => (
              <div key={news.id} className="p-4 hover:bg-slate-50 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 transition-colors">
                <div className="flex gap-4 flex-1 min-w-0 w-full">
                  {news.image_url ? (
                    <img src={news.image_url} alt="thumbnail" className="w-24 h-24 object-cover rounded-lg flex-shrink-0" />
                  ) : (
                    <div className="w-24 h-24 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 flex-shrink-0">
                      <ImageIcon className="w-8 h-8" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <h3 className="text-lg font-bold text-slate-900 truncate" title={news.title}>{news.title}</h3>
                    <p className="text-sm text-slate-500 line-clamp-2 mt-1" title={news.summary || news.content}>{news.summary || news.content}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-400 font-medium">
                      <span>Created: {new Date(news.created_at).toLocaleDateString()}</span>
                      {news.published_at && <span className="text-emerald-600">Published: {new Date(news.published_at).toLocaleDateString()}</span>}
                    </div>
                  </div>
                </div>
                
                <div className="flex sm:flex-row xl:flex-col gap-2 flex-shrink-0 w-full xl:w-auto justify-end mt-4 xl:mt-0">
                  {activeTab === 'drafts' ? (
                    <button 
                      onClick={() => togglePublishStatus(news)}
                      className="flex items-center justify-center px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-sm font-bold transition-colors whitespace-nowrap"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" /> Approve & Publish
                    </button>
                  ) : (
                    <button 
                      onClick={() => togglePublishStatus(news)}
                      className="flex items-center justify-center px-4 py-2 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg text-sm font-bold transition-colors whitespace-nowrap"
                    >
                      <XCircle className="w-4 h-4 mr-2" /> Unpublish (Draft)
                    </button>
                  )}
                  
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleOpenModal(news)}
                      className="flex-1 flex justify-center items-center px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-primary rounded-lg text-sm font-medium transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(news.id)}
                      className="flex-1 flex justify-center items-center px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-900">
                {editingId ? 'Edit News Article' : 'Manual News Entry'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit(onSubmitForm)} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 space-y-4 overflow-y-auto flex-1">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Headline Title</label>
                  <input
                    {...register('title')}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    placeholder="Enter article title"
                  />
                  {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Image URL (Optional)</label>
                  <input
                    {...register('image_url')}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    placeholder="https://example.com/image.jpg"
                  />
                  {errors.image_url && <p className="text-red-500 text-xs mt-1">{errors.image_url.message}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Short Summary</label>
                  <textarea
                    {...register('summary')}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    placeholder="Brief summary for the card..."
                    rows={2}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Full Content / Article Link</label>
                  <textarea
                    {...register('content')}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    placeholder="Full article text or original source link..."
                    rows={6}
                  />
                  {errors.content && <p className="text-red-500 text-xs mt-1">{errors.content.message}</p>}
                </div>
              </div>

              <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary-600 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : (editingId ? 'Save Changes' : 'Save as Draft')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
