// @ts-nocheck
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Megaphone, Plus, Save, Clock, CheckCircle2 } from 'lucide-react';
import { adminService } from '../../services/adminService';
import type { Announcement } from '../../types/database.types';

const announcementSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters'),
  content: z.string().min(10, 'Content must be at least 10 characters'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']),
});

const directMessageSchema = z.object({
  userId: z.string().min(10, 'Valid User ID required'),
  title: z.string().min(5, 'Title required'),
  message: z.string().min(10, 'Message required'),
});

type AnnouncementValues = z.infer<typeof announcementSchema>;
type DirectMessageValues = z.infer<typeof directMessageSchema>;

export function SystemManagement() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'announcements' | 'direct'>('announcements');
  const [dmSuccess, setDmSuccess] = useState(false);

  const { register: registerAnnounce, handleSubmit: handleAnnounceSubmit, reset: resetAnnounce, formState: { errors: errorsAnnounce } } = useForm<AnnouncementValues>({
    resolver: zodResolver(announcementSchema),
    defaultValues: { priority: 'normal' }
  });

  const { register: registerDm, handleSubmit: handleDmSubmit, reset: resetDm, formState: { errors: errorsDm } } = useForm<DirectMessageValues>({
    resolver: zodResolver(directMessageSchema)
  });

  const loadAnnouncements = async () => {
    const data = await adminService.getActiveAnnouncements();
    setAnnouncements(data);
  };

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const onAnnounceSubmit = async (data: AnnouncementValues) => {
    setIsSubmitting(true);
    const newAnnouncement = await adminService.publishAnnouncement({
      title: data.title,
      content: data.content,
      priority: data.priority,
      is_published: true,
      valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // Valid for 30 days
    });

    if (newAnnouncement) {
      resetAnnounce();
      setIsCreating(false);
      loadAnnouncements();
    }
    setIsSubmitting(false);
  };

  const onDmSubmit = async (data: DirectMessageValues) => {
    setIsSubmitting(true);
    setDmSuccess(false);
    
    const notification = await adminService.sendNotification({
      user_id: data.userId,
      title: data.title,
      message: data.message,
      is_read: false
    });

    if (notification) {
      setDmSuccess(true);
      resetDm();
      setTimeout(() => setDmSuccess(false), 3000);
    }
    setIsSubmitting(false);
  };

  return (
    <div className="space-y-6">
      {/* Sub-tabs for System Tools */}
      <div className="flex space-x-2 border-b border-slate-200">
        <button 
          onClick={() => setActiveTab('announcements')}
          className={`px-4 py-2 font-bold text-sm border-b-2 transition-colors ${activeTab === 'announcements' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Public Announcements
        </button>
        <button 
          onClick={() => setActiveTab('direct')}
          className={`px-4 py-2 font-bold text-sm border-b-2 transition-colors ${activeTab === 'direct' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Direct User Messages
        </button>
      </div>

      {activeTab === 'announcements' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 flex items-center">
              <Megaphone className="w-5 h-5 mr-2 text-primary" /> Global Announcements
            </h2>
            {!isCreating && (
              <button 
                onClick={() => setIsCreating(true)}
                className="inline-flex items-center px-4 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary-700 transition-colors"
              >
                <Plus className="w-4 h-4 mr-2" /> New Announcement
              </button>
            )}
          </div>

        {isCreating && (
          <form onSubmit={handleAnnounceSubmit(onAnnounceSubmit)} className="p-6 bg-slate-50 border-b border-slate-200">
            <div className="space-y-4 max-w-2xl">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Title</label>
                <input
                  type="text"
                  {...registerAnnounce('title')}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="System Maintenance Notice"
                />
                {errorsAnnounce.title && <p className="mt-1 text-sm text-red-600">{errorsAnnounce.title.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Content</label>
                <textarea
                  {...registerAnnounce('content')}
                  rows={4}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary resize-none"
                />
                {errorsAnnounce.content && <p className="mt-1 text-sm text-red-600">{errorsAnnounce.content.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Priority Level</label>
                <select
                  {...registerAnnounce('priority')}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 text-sm font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 text-sm font-bold text-white bg-primary rounded-lg hover:bg-primary-700 flex items-center disabled:opacity-50"
                >
                  {isSubmitting ? 'Publishing...' : <><Save className="w-4 h-4 mr-2" /> Publish Now</>}
                </button>
              </div>
            </div>
          </form>
        )}

        <div className="p-6">
          {announcements.length === 0 ? (
            <p className="text-slate-500 text-center py-8">No active announcements.</p>
          ) : (
            <div className="space-y-4">
              {announcements.map((announcement) => (
                <div key={announcement.id} className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm flex items-start gap-4">
                  <div className={`p-2 rounded-lg shrink-0 ${
                    announcement.priority === 'urgent' ? 'bg-red-100 text-red-600' :
                    announcement.priority === 'high' ? 'bg-orange-100 text-orange-600' :
                    'bg-blue-100 text-blue-600'
                  }`}>
                    <Megaphone className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="font-bold text-slate-900">{announcement.title}</h3>
                      <span className="flex items-center text-xs font-semibold text-slate-500 uppercase">
                        <Clock className="w-3 h-3 mr-1" /> {new Date(announcement.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 whitespace-pre-wrap">{announcement.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      )}

      {activeTab === 'direct' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden p-6">
          <div className="max-w-2xl">
            <h2 className="text-lg font-bold text-slate-900 mb-2">Push Direct Notification</h2>
            <p className="text-slate-500 text-sm mb-6">Send an immediate in-app alert to a specific user's notification center.</p>
            
            {dmSuccess && (
              <div className="mb-6 bg-green-50 text-green-700 p-4 rounded-xl text-sm font-bold border border-green-200 flex items-center">
                <CheckCircle2 className="w-5 h-5 mr-2" /> Message delivered successfully!
              </div>
            )}

            <form onSubmit={handleDmSubmit(onDmSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">User ID (UUID)</label>
                <input
                  type="text"
                  {...registerDm('userId')}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary font-mono text-sm"
                  placeholder="e.g., a1b2c3d4-..."
                />
                {errorsDm.userId && <p className="mt-1 text-sm text-red-600">{errorsDm.userId.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Alert Title</label>
                <input
                  type="text"
                  {...registerDm('title')}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="Important Account Update"
                />
                {errorsDm.title && <p className="mt-1 text-sm text-red-600">{errorsDm.title.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Message Body</label>
                <textarea
                  {...registerDm('message')}
                  rows={4}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary resize-none"
                  placeholder="Enter the alert message..."
                />
                {errorsDm.message && <p className="mt-1 text-sm text-red-600">{errorsDm.message.message}</p>}
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-3 text-sm font-bold text-white bg-slate-900 rounded-lg hover:bg-slate-800 flex items-center disabled:opacity-50"
                >
                  {isSubmitting ? 'Sending...' : <><Megaphone className="w-4 h-4 mr-2" /> Push Alert Now</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
