import React, { useState, useEffect, useRef } from 'react';
import { adminService } from '../../services/adminService';
import type { FaqItem } from '../../types/database.types';
import { HelpCircle, Edit2, Trash2, Plus, XCircle, Search, GripVertical } from 'lucide-react';
import clsx from 'clsx';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const faqSchema = z.object({
  question: z.string().min(5, "Question must be at least 5 characters"),
  answer: z.string().min(10, "Answer must be at least 10 characters"),
  category: z.enum(['mstc', 'lelam']),
  display_order: z.number().int().nonnegative("Must be a positive number"),
  is_active: z.boolean(),
});

type FaqFormValues = z.infer<typeof faqSchema>;

export function FaqManagement() {
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'all' | 'mstc' | 'lelam'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<FaqFormValues>({
    resolver: zodResolver(faqSchema),
    defaultValues: {
      question: '',
      answer: '',
      category: 'mstc',
      display_order: 1,
      is_active: true
    }
  });

  const loadFaqs = async () => {
    setIsLoading(true);
    const data = await adminService.getFaqItemsAdmin();
    setFaqs(data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadFaqs();
  }, []);

  const handleOpenModal = (faq?: FaqItem) => {
    if (faq) {
      setEditingId(faq.id);
      setValue('question', faq.question);
      setValue('answer', faq.answer);
      setValue('category', (faq.category === 'lelam' ? 'lelam' : 'mstc') as 'mstc' | 'lelam');
      setValue('display_order', faq.display_order || 0);
      setValue('is_active', faq.is_active);
    } else {
      setEditingId(null);
      // Auto increment display order based on current list length
      const nextOrder = faqs.length + 1;
      reset({
        question: '',
        answer: '',
        category: 'lelam',
        display_order: nextOrder,
        is_active: true
      });
    }
    setIsModalOpen(true);
  };

  const onSubmitForm = async (data: FaqFormValues) => {
    let success = false;
    if (editingId) {
      success = await adminService.updateFaqItem(editingId, data);
      if (success) showFeedback('FAQ updated successfully!');
    } else {
      success = await adminService.createFaqItem(data);
      if (success) showFeedback('FAQ created successfully!');
    }
    
    if (success) {
      setIsModalOpen(false);
      await loadFaqs();
    } else {
      showFeedback('An error occurred. Please try again.', true);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this FAQ item?')) {
      const success = await adminService.deleteFaqItem(id);
      if (success) {
        showFeedback('FAQ deleted successfully!');
        await loadFaqs();
      } else {
        showFeedback('Failed to delete FAQ.', true);
      }
    }
  };

  const toggleActiveStatus = async (faq: FaqItem) => {
    const updatedStatus = !faq.is_active;
    const success = await adminService.updateFaqItem(faq.id, { is_active: updatedStatus });
    if (success) {
      await loadFaqs();
    }
  };

  const showFeedback = (msg: string, _isError = false) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 4000);
  };

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const draggedIndexRef = useRef<number | null>(null);

  const handleDragStart = (index: number) => {
    draggedIndexRef.current = index;
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndexRef.current === index) return;
    setDragOverIndex(index);
  };

  const handleDragEnd = () => {
    // Only clean up visual state — drop handler does the real work
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const sourceIndex = draggedIndexRef.current;
    draggedIndexRef.current = null;
    setDraggedIndex(null);
    setDragOverIndex(null);

    if (sourceIndex === null || sourceIndex === targetIndex) return;

    // Create a new array based on current filtered items
    const newFiltered = [...filteredFaqs];
    const draggedItem = newFiltered[sourceIndex];

    // Remove the item from its original position
    newFiltered.splice(sourceIndex, 1);
    // Insert the item at the target position
    newFiltered.splice(targetIndex, 0, draggedItem);

    // Update display orders globally
    const updatedFaqs = [...faqs];
    newFiltered.forEach((item, idx) => {
      const mainIndex = updatedFaqs.findIndex(f => f.id === item.id);
      if (mainIndex !== -1) {
        updatedFaqs[mainIndex] = {
          ...updatedFaqs[mainIndex],
          display_order: idx + 1
        };
      }
    });

    // Sort to keep local list consistent
    updatedFaqs.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
    setFaqs(updatedFaqs);

    const itemsToUpdate = newFiltered.map((item, idx) => ({
      id: item.id,
      display_order: idx + 1
    }));

    const success = await adminService.reorderFaqItems(itemsToUpdate);
    if (success) {
      showFeedback('FAQ order updated successfully!');
      await loadFaqs();
    } else {
      showFeedback('Failed to save FAQ order.', true);
      await loadFaqs();
    }
  };

  const filteredFaqs = faqs.filter((faq) => {
    const cat = faq.category === 'lelam' ? 'lelam' : 'mstc';
    if (activeFilter !== 'all' && cat !== activeFilter) return false;
    
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return faq.question.toLowerCase().includes(q) || faq.answer.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center">
            <HelpCircle className="w-6 h-6 mr-2 text-primary" />
            FAQ / Help Center Manager
          </h2>
          <p className="text-sm text-slate-500 mt-1">Manage public questions, explainers, and search tags.</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center px-4 py-2.5 bg-primary text-white hover:bg-primary/95 rounded-lg text-sm font-bold transition-all shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add FAQ Item
        </button>
      </div>

      {message && (
        <div className={clsx(
          "p-4 rounded-xl text-sm font-medium transition-all shadow-2xs",
          message.toLowerCase().includes('error') || message.toLowerCase().includes('failed')
            ? "bg-red-50 text-red-700 border border-red-150"
            : "bg-emerald-50 text-emerald-700 border border-emerald-150"
        )}>
          {message}
        </div>
      )}

      {/* Filters and Search */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search FAQs by keywords..."
            className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex gap-2 bg-slate-100 p-1 rounded-lg self-start md:self-auto">
          <button
            onClick={() => setActiveFilter('all')}
            className={clsx(
              "px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer",
              activeFilter === 'all' ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-900"
            )}
          >
            All FAQs ({faqs.length})
          </button>
          <button
            onClick={() => setActiveFilter('mstc')}
            className={clsx(
              "px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer",
              activeFilter === 'mstc' ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-900"
            )}
          >
            MSTC eAuctions ({faqs.filter(f => f.category !== 'lelam').length})
          </button>
          <button
            onClick={() => setActiveFilter('lelam')}
            className={clsx(
              "px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer",
              activeFilter === 'lelam' ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-900"
            )}
          >
            Lelam Platform ({faqs.filter(f => f.category === 'lelam').length})
          </button>
        </div>
      </div>

      {/* Drag & Drop Hint */}
      <div className="text-xs">
        {!searchQuery ? (
          <p className="text-slate-500 flex items-center gap-1.5 px-3 py-2 bg-slate-500/5 border border-slate-200/50 rounded-xl max-w-fit shadow-3xs">
            <GripVertical className="w-3.5 h-3.5 text-slate-400" />
            <span><strong>Tip:</strong> Drag and drop rows using the handle to change display order hierarchy.</span>
          </p>
        ) : (
          <p className="text-amber-600 flex items-center gap-1 px-3 py-2 bg-amber-500/5 border border-amber-150 rounded-xl max-w-fit shadow-3xs">
            <span><strong>Note:</strong> Reordering via drag & drop is disabled while search filters are active.</span>
          </p>
        )}
      </div>

      {/* FAQ Table/List */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-16 space-y-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="text-sm font-semibold text-slate-550">Loading FAQ records...</p>
          </div>
        ) : filteredFaqs.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            No FAQs found matching your criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-250 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-6 py-4 w-16 text-center">Order</th>
                  <th className="px-6 py-4">Question & Answer</th>
                  <th className="px-6 py-4 w-36">Category</th>
                  <th className="px-6 py-4 w-28 text-center">Status</th>
                  <th className="px-6 py-4 w-28 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredFaqs.map((faq, index) => {
                  const isDragged = draggedIndex === index;
                  const isDragOver = dragOverIndex === index;
                  return (
                    <tr 
                      key={faq.id} 
                      draggable={!searchQuery}
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragEnd={handleDragEnd}
                      onDrop={(e) => handleDrop(e, index)}
                      className={clsx(
                        "hover:bg-slate-50/50 group transition-all duration-150",
                        isDragged && "opacity-35 bg-slate-100/50",
                        isDragOver && "border-t-2 border-primary bg-primary/5"
                      )}
                    >
                      <td className="px-6 py-4 text-center font-mono text-sm text-slate-400">
                        <div className="flex items-center justify-center gap-1.5">
                          {!searchQuery && (
                            <GripVertical className="w-3.5 h-3.5 text-slate-300 hover:text-slate-500 transition-colors cursor-grab active:cursor-grabbing" />
                          )}
                          <span>{faq.display_order}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 max-w-xl">
                        <p className="text-sm font-bold text-slate-900 mb-1">{faq.question}</p>
                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{faq.answer}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={clsx(
                          "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider",
                          faq.category === 'lelam'
                            ? "bg-purple-50 text-purple-700 border border-purple-100"
                            : "bg-blue-50 text-blue-700 border border-blue-100"
                        )}>
                          {faq.category === 'lelam' ? 'Lelam Platform' : 'MSTC eAuction'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => toggleActiveStatus(faq)}
                          className={clsx(
                            "px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer border",
                            faq.is_active
                              ? "bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100"
                              : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-150"
                          )}
                        >
                          {faq.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex gap-2 justify-end opacity-80 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleOpenModal(faq)}
                            className="p-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-primary rounded-lg transition-colors cursor-pointer"
                            title="Edit FAQ"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(faq.id)}
                            className="p-1.5 border border-red-150 text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete FAQ"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CRUD Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-250 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-900">
                {editingId ? 'Edit FAQ Item' : 'Create New FAQ Item'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmitForm)} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 space-y-4 overflow-y-auto flex-1">
                
                {/* Question */}
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Question</label>
                  <input
                    {...register('question')}
                    placeholder="e.g. How does Lelam calculate estimated ROI?"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all text-sm"
                  />
                  {errors.question && <p className="text-red-500 text-xs mt-1 font-semibold">{errors.question.message}</p>}
                </div>

                {/* Answer */}
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Answer</label>
                  <textarea
                    {...register('answer')}
                    placeholder="Enter the detailed explanation here..."
                    rows={6}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all text-sm resize-none"
                  />
                  {errors.answer && <p className="text-red-500 text-xs mt-1 font-semibold">{errors.answer.message}</p>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Category */}
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Category</label>
                    <select
                      {...register('category')}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-lg bg-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all text-sm font-medium"
                    >
                      <option value="mstc">MSTC eAuctions Help</option>
                      <option value="lelam">Lelam Platform Help</option>
                    </select>
                  </div>

                  {/* Display Order */}
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Display Order</label>
                    <input
                      type="number"
                      {...register('display_order', { valueAsNumber: true })}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all text-sm font-mono"
                    />
                  </div>
                </div>

                {/* Is Active Checkbox */}
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    {...register('is_active')}
                    className="w-4 h-4 text-primary border-slate-300 rounded focus:ring-primary/20"
                  />
                  <label htmlFor="is_active" className="text-sm font-bold text-slate-700 cursor-pointer">
                    Publish immediately (Show live in Help Center)
                  </label>
                </div>
              </div>

              {/* Form Footer */}
              <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/95 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Saving...' : (editingId ? 'Save Changes' : 'Create FAQ')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
