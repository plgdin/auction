// @ts-nocheck
import { useEffect, useState } from 'react';
import { Mail, Clock, User, Tag, ChevronDown, ChevronUp, Search, Inbox, CheckCircle, AlertCircle } from 'lucide-react';
import { adminService } from '../../services/adminService';
import type { ContactMessage } from '../../types/database.types';
import clsx from 'clsx';

type MessageStatus = 'all' | 'pending' | 'reviewed' | 'resolved';

export function ContactMessages() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<MessageStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadMessages();
  }, []);

  const loadMessages = async () => {
    setIsLoading(true);
    const data = await adminService.getContactMessages();
    setMessages(data);
    setIsLoading(false);
  };

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    const success = await adminService.updateContactMessageStatus(id, newStatus);
    if (success) {
      setMessages(prev => prev.map(m => m.id === id ? { ...m, status: newStatus } : m));
    }
  };

  const filteredMessages = messages.filter(m => {
    const matchesStatus = filterStatus === 'all' || m.status === filterStatus;
    const matchesSearch = !searchQuery.trim() ||
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.subject || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.message.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'resolved':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"><CheckCircle size={12} /> Resolved</span>;
      case 'reviewed':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200"><AlertCircle size={12} /> Reviewed</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200"><Clock size={12} /> Pending</span>;
    }
  };

  const extractIssueType = (subject: string | undefined): string | null => {
    if (!subject) return null;
    const match = subject.match(/^\[(.+?)\]/);
    return match ? match[1] : null;
  };

  const pendingCount = messages.filter(m => m.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Messages', value: messages.length, color: 'text-slate-900' },
          { label: 'Pending', value: pendingCount, color: 'text-amber-600' },
          { label: 'Reviewed', value: messages.filter(m => m.status === 'reviewed').length, color: 'text-blue-600' },
          { label: 'Resolved', value: messages.filter(m => m.status === 'resolved').length, color: 'text-emerald-600' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-mono uppercase text-slate-500 tracking-wider">{stat.label}</p>
            <p className={clsx("text-2xl font-black mt-1", stat.color)}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {(['all', 'pending', 'reviewed', 'resolved'] as MessageStatus[]).map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={clsx(
                "px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all",
                filterStatus === status
                  ? "bg-primary text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              )}
            >
              {status}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search messages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
      </div>

      {/* Messages List */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
        </div>
      ) : filteredMessages.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-slate-300">
          <Inbox className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-lg font-semibold text-slate-500">No messages found</p>
          <p className="text-sm text-slate-400 mt-1">
            {filterStatus !== 'all' ? `No ${filterStatus} messages.` : 'Contact submissions will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredMessages.map((msg) => {
            const isExpanded = expandedId === msg.id;
            const issueType = extractIssueType(msg.subject);
            const cleanSubject = msg.subject?.replace(/^\[.+?\]\s*/, '') || 'No Subject';
            const timeAgo = new Date(msg.created_at).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={msg.id}
                className={clsx(
                  "bg-white border rounded-xl overflow-hidden transition-all duration-200",
                  isExpanded
                    ? "border-primary/30 shadow-md ring-1 ring-primary/10"
                    : "border-slate-200 hover:border-slate-300 hover:shadow-sm"
                )}
              >
                {/* Header Row */}
                <button
                  className="w-full px-5 py-4 flex items-center justify-between focus:outline-none text-left"
                  onClick={() => setExpandedId(isExpanded ? null : msg.id)}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold text-sm">
                      {msg.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-sm">{msg.name}</span>
                        {getStatusBadge(msg.status)}
                        {issueType && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            <Tag size={10} />
                            {issueType}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{cleanSubject}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-slate-400 whitespace-nowrap hidden sm:inline">{timeAgo}</span>
                    {isExpanded
                      ? <ChevronUp className="w-5 h-5 text-primary" />
                      : <ChevronDown className="w-5 h-5 text-slate-400" />
                    }
                  </div>
                </button>

                {/* Expanded Content */}
                <div className={clsx(
                  "overflow-hidden transition-all duration-300 ease-in-out",
                  isExpanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
                )}>
                  <div className="px-5 pb-5 border-t border-slate-100 pt-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <User size={14} className="text-slate-400" />
                        <span className="font-medium">{msg.name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Mail size={14} className="text-slate-400" />
                        <a href={`mailto:${msg.email}`} className="text-primary hover:underline">{msg.email}</a>
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-700 leading-relaxed whitespace-pre-line border border-slate-100">
                      {msg.message}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 mt-4">
                      {msg.status !== 'reviewed' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleStatusUpdate(msg.id, 'reviewed'); }}
                          className="px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
                        >
                          Mark as Reviewed
                        </button>
                      )}
                      {msg.status !== 'resolved' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleStatusUpdate(msg.id, 'resolved'); }}
                          className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                        >
                          Mark as Resolved
                        </button>
                      )}
                      <a
                        href={`mailto:${msg.email}?subject=Re: ${msg.subject || 'Your Inquiry'}`}
                        className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Reply via Email
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
