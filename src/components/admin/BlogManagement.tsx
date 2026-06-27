import { useEffect, useState, useMemo, useRef } from 'react';
import { 
  Plus, Edit, Trash2, CheckCircle, XCircle, 
  ArrowUp, ArrowDown, Image as ImageIcon, Save, X, FileText, UploadCloud, Loader2, Link
} from 'lucide-react';
import JoditEditor from 'jodit-react';
import { blogService } from '../../services/blogService';
import { storageService } from '../../services/storageService';
import type { Blog } from '../../types/database.types';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export function BlogManagement() {
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentBlog, setCurrentBlog] = useState<Partial<Blog> | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const editorRef = useRef<any>(null);
  
  // Custom Link Preview Modal State
  const [linkModal, setLinkModal] = useState({
    isOpen: false,
    url: '',
    text: '',
    imageUrl: '',
    isUploading: false,
    isDragging: false
  });

  const handleLinkImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }
    
    setLinkModal(prev => ({ ...prev, isUploading: true }));
    try {
      const url = await storageService.uploadBlogImage(file);
      if (url) {
        setLinkModal(prev => ({ ...prev, imageUrl: url }));
        toast.success('Preview image uploaded successfully');
      } else {
        toast.error('Failed to upload image');
      }
    } catch (error) {
      toast.error('Failed to upload image');
    } finally {
      setLinkModal(prev => ({ ...prev, isUploading: false }));
    }
  };

  const insertCustomLink = () => {
    if (!linkModal.url) {
      toast.error('URL is required');
      return;
    }
    
    const displayUrl = linkModal.url.startsWith('http') ? linkModal.url : `https://${linkModal.url}`;
    const displayText = linkModal.text || linkModal.url;
    
    const htmlToInsert = linkModal.imageUrl 
      ? `<a href="${displayUrl}" data-image-src="${linkModal.imageUrl}">${displayText}</a>`
      : `<a href="${displayUrl}">${displayText}</a>`;

    if (editorRef.current) {
      editorRef.current.s.insertHTML(htmlToInsert);
    }
    
    setLinkModal({ isOpen: false, url: '', text: '', imageUrl: '', isUploading: false, isDragging: false });
  };

  // Memoize Jodit config to prevent re-renders that break internal dialogs like the link popup
  const editorConfig = useMemo(() => {
    const customButtons = [
      'source', '|',
      'bold', 'strikethrough', 'underline', 'italic', '|',
      'ul', 'ol', '|',
      'outdent', 'indent',  '|',
      'font', 'fontsize', 'brush', 'paragraph', '|',
      'image', 'video', 'table', 'link', 'previewLink', '|',
      'align', 'undo', 'redo', '|',
      'hr', 'eraser', 'copyformat', 'fullsize'
    ];
    
    return {
      readonly: false,
      height: 400,
      zIndex: 99999, // Ensure popups are above other elements
      askBeforePasteHTML: false,
      askBeforePasteFromWord: false,
      defaultActionOnPaste: 'insert_as_html' as const,
      buttons: customButtons,
      buttonsMD: customButtons,
      buttonsSM: customButtons,
      buttonsXS: customButtons,
    extraButtons: [
      {
        name: 'previewLink',
        iconURL: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>',
        tooltip: 'Insert Link with Custom Preview Image',
        exec: (editor: any) => {
          const selectedText = editor.s.html().replace(/<[^>]*>?/gm, ''); // Get selected text and strip HTML
          setLinkModal({
            isOpen: true,
            url: '',
            text: selectedText || '',
            imageUrl: '',
            isUploading: false,
            isDragging: false
          });
        }
      }
    ]
  };
  }, []);

  useEffect(() => {
    loadBlogs();
  }, []);

  const loadBlogs = async () => {
    setIsLoading(true);
    try {
      // Get all blogs, including unpublished, for admin view
      const data = await blogService.getBlogs(false);
      setBlogs(data);
    } catch (error) {
      toast.error('Failed to load blogs');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateNew = () => {
    setCurrentBlog({
      title: '',
      content: '',
      is_featured: false,
      is_published: true,
      display_order: blogs.length + 1,
      author_name: 'Admin',
      published_at: new Date().toISOString()
    });
    setIsModalOpen(true);
  };

  const handleEdit = (blog: Blog) => {
    setCurrentBlog(blog);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this blog?')) return;
    
    try {
      await blogService.deleteBlog(id);
      toast.success('Blog deleted successfully');
      loadBlogs();
    } catch (error) {
      toast.error('Failed to delete blog');
    }
  };

  const handleSave = async () => {
    if (!currentBlog?.title || !currentBlog?.content) {
      toast.error('Title and content are required');
      return;
    }

    setIsSaving(true);
    try {
      if (currentBlog.id) {
        await blogService.updateBlog(currentBlog.id, currentBlog);
        toast.success('Blog updated successfully');
      } else {
        await blogService.createBlog(currentBlog);
        toast.success('Blog created successfully');
      }
      setIsModalOpen(false);
      loadBlogs();
    } catch (error) {
      toast.error('Failed to save blog');
    } finally {
      setIsSaving(false);
    }
  };

  const moveOrder = async (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === blogs.length - 1) return;

    const newBlogs = [...blogs];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    
    // Swap display orders
    const tempOrder = newBlogs[index].display_order;
    newBlogs[index].display_order = newBlogs[swapIndex].display_order;
    newBlogs[swapIndex].display_order = tempOrder;

    // Swap in array for immediate UI update
    const tempBlog = newBlogs[index];
    newBlogs[index] = newBlogs[swapIndex];
    newBlogs[swapIndex] = tempBlog;

    setBlogs(newBlogs);

    // Save to DB
    try {
      await blogService.updateDisplayOrders([
        { id: newBlogs[index].id, display_order: newBlogs[index].display_order },
        { id: newBlogs[swapIndex].id, display_order: newBlogs[swapIndex].display_order }
      ]);
    } catch (error) {
      toast.error('Failed to update order');
      loadBlogs(); // Revert on failure
    }
  };

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }
    
    setIsUploading(true);
    try {
      const url = await storageService.uploadBlogImage(file);
      if (url) {
        setCurrentBlog(prev => prev ? { ...prev, image_url: url } : null);
        toast.success('Image uploaded successfully');
      } else {
        toast.error('Failed to upload image');
      }
    } catch (error) {
      toast.error('Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageUpload(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-lg shadow-sm border border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Blog Management</h2>
          <p className="text-sm text-slate-500 mt-1">Create, edit, and organize public blog posts.</p>
        </div>
        <button
          onClick={handleCreateNew}
          className="flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-600 transition-colors shadow-sm font-medium"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Blog
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500">Loading blogs...</div>
        ) : blogs.length === 0 ? (
          <div className="p-8 text-center text-slate-500 flex flex-col items-center">
            <FileText className="w-12 h-12 text-slate-300 mb-3" />
            <p>No blogs found. Create your first blog post!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-semibold">Order</th>
                  <th className="px-6 py-4 font-semibold">Title</th>
                  <th className="px-6 py-4 font-semibold text-center">Featured</th>
                  <th className="px-6 py-4 font-semibold text-center">Status</th>
                  <th className="px-6 py-4 font-semibold">Date</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {blogs.map((blog, index) => (
                  <tr key={blog.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-3 whitespace-nowrap">
                      <div className="flex flex-col items-center w-8">
                        <button 
                          onClick={() => moveOrder(index, 'up')}
                          disabled={index === 0}
                          className="p-1 text-slate-400 hover:text-primary disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <span className="text-xs font-bold text-slate-600">{blog.display_order}</span>
                        <button 
                          onClick={() => moveOrder(index, 'down')}
                          disabled={index === blogs.length - 1}
                          className="p-1 text-slate-400 hover:text-primary disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {blog.image_url ? (
                          <img src={blog.image_url} alt="" className="w-10 h-10 rounded object-cover border border-slate-200" />
                        ) : (
                          <div className="w-10 h-10 rounded bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200">
                            <ImageIcon className="w-4 h-4" />
                          </div>
                        )}
                        <span className="font-medium text-slate-900 line-clamp-1">{blog.title}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {blog.is_featured ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                          Featured
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {blog.is_published ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                          <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> Published
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          <XCircle className="w-3.5 h-3.5 mr-1.5" /> Draft
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-500">
                      {format(new Date(blog.created_at), 'MMM d, yyyy')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleEdit(blog)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(blog.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Editor Modal */}
      {isModalOpen && currentBlog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col my-8">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-900">
                {currentBlog.id ? 'Edit Blog Post' : 'Create New Blog Post'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Title</label>
                  <input
                    type="text"
                    value={currentBlog.title || ''}
                    onChange={(e) => setCurrentBlog({...currentBlog, title: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                    placeholder="Enter blog title"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Author Name</label>
                  <input
                    type="text"
                    value={currentBlog.author_name || ''}
                    onChange={(e) => setCurrentBlog({...currentBlog, author_name: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                    placeholder="e.g. Admin or John Doe"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Publish Date</label>
                  <input
                    type="date"
                    value={currentBlog.published_at ? format(new Date(currentBlog.published_at), "yyyy-MM-dd") : ''}
                    onChange={(e) => setCurrentBlog({...currentBlog, published_at: new Date(e.target.value).toISOString()})}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Cover Image</label>
                  <div 
                    className={`relative border-2 border-dashed rounded-lg p-4 transition-colors ${isDragging ? 'border-primary bg-primary/5' : 'border-slate-300 hover:border-primary/50'}`}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                  >
                    <input
                      type="text"
                      value={currentBlog.image_url || ''}
                      onChange={(e) => setCurrentBlog({...currentBlog, image_url: e.target.value})}
                      className="w-full px-4 py-2 mb-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-sm"
                      placeholder="Paste image URL here..."
                    />
                    
                    <div className="flex flex-col items-center justify-center text-center py-2">
                      {isUploading ? (
                        <Loader2 className="w-8 h-8 text-primary animate-spin mb-2" />
                      ) : (
                        <UploadCloud className="w-8 h-8 text-slate-400 mb-2" />
                      )}
                      <p className="text-xs text-slate-500 mb-1">
                        <span className="font-semibold text-primary cursor-pointer hover:underline relative">
                          Click to upload
                          <input 
                            type="file" 
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                            accept="image/*"
                            onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
                            disabled={isUploading}
                          />
                        </span>
                        {' '}or drag and drop
                      </p>
                      <p className="text-[10px] text-slate-400">SVG, PNG, JPG or GIF</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-8 border border-slate-200 p-4 rounded-lg bg-slate-50">
                <label className="flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={currentBlog.is_featured}
                    onChange={(e) => setCurrentBlog({...currentBlog, is_featured: e.target.checked})}
                    className="w-4 h-4 text-primary rounded border-slate-300 focus:ring-primary"
                  />
                  <span className="ml-2 text-sm font-medium text-slate-700">Mark as Featured</span>
                </label>
                
                <label className="flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={currentBlog.is_published}
                    onChange={(e) => setCurrentBlog({...currentBlog, is_published: e.target.checked})}
                    className="w-4 h-4 text-green-600 rounded border-slate-300 focus:ring-green-500"
                  />
                  <span className="ml-2 text-sm font-medium text-slate-700">Publish immediately</span>
                </label>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Content</label>
                <div className="border border-slate-300 rounded-lg">
                  <JoditEditor
                    ref={editorRef}
                    value={currentBlog.content || ''} 
                    config={editorConfig}
                    onBlur={(newContent) => setCurrentBlog({...currentBlog, content: newContent})}
                  />
                </div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs text-slate-600">
                <p className="font-semibold text-slate-800 flex items-center">
                  <span className="mr-1">💡</span> Dynamic Link Preview & Custom Image Guide
                </p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>
                    To add a link preview, simply use the <strong>Link with Custom Preview Image</strong> button in the editor toolbar (the second link icon).
                  </li>
                  <li>
                    A popup will appear where you can type the URL, text, and easily drag-and-drop a custom image for the preview.
                  </li>
                  <li>
                    If no custom image is provided, a live screenshot of the target page will be loaded automatically!
                  </li>
                </ul>
              </div>
              
            </div>
            
            <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-xl flex justify-end gap-3 shrink-0">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-5 py-2.5 text-sm font-semibold bg-primary text-white hover:bg-primary-600 rounded-lg shadow-sm transition-colors flex items-center"
              >
                {isSaving ? (
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Blog
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Link Preview Image Modal */}
      {linkModal.isOpen && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50">
              <h3 className="text-lg font-bold text-slate-900 flex items-center">
                <Link className="w-5 h-5 mr-2 text-primary" />
                Insert Link with Preview
              </h3>
              <button 
                onClick={() => setLinkModal(prev => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">URL Destination</label>
                <input
                  type="text"
                  value={linkModal.url}
                  onChange={(e) => setLinkModal(prev => ({ ...prev, url: e.target.value }))}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                  placeholder="https://example.com"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">Link Text</label>
                <input
                  type="text"
                  value={linkModal.text}
                  onChange={(e) => setLinkModal(prev => ({ ...prev, text: e.target.value }))}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                  placeholder="Click here"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 flex justify-between">
                  <span>Custom Preview Image</span>
                  <span className="text-xs font-normal text-slate-400">(Optional)</span>
                </label>
                <div 
                  className={`relative border-2 border-dashed rounded-lg p-4 transition-colors text-center ${linkModal.isDragging ? 'border-primary bg-primary/5' : 'border-slate-300 hover:border-primary/50'}`}
                  onDragOver={(e) => { e.preventDefault(); setLinkModal(prev => ({ ...prev, isDragging: true })); }}
                  onDragLeave={() => setLinkModal(prev => ({ ...prev, isDragging: false }))}
                  onDrop={(e) => {
                    e.preventDefault();
                    setLinkModal(prev => ({ ...prev, isDragging: false }));
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleLinkImageUpload(e.dataTransfer.files[0]);
                    }
                  }}
                >
                  {linkModal.imageUrl ? (
                    <div className="relative group rounded overflow-hidden">
                      <img src={linkModal.imageUrl} alt="Preview" className="w-full h-32 object-cover rounded border border-slate-200" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <button 
                          onClick={() => setLinkModal(prev => ({ ...prev, imageUrl: '' }))}
                          className="bg-white text-red-600 px-3 py-1.5 rounded text-xs font-bold hover:bg-red-50"
                        >
                          Remove Image
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <input
                        type="text"
                        value={linkModal.imageUrl}
                        onChange={(e) => setLinkModal(prev => ({ ...prev, imageUrl: e.target.value }))}
                        className="w-full px-3 py-1.5 mb-3 border border-slate-300 rounded-md focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-sm"
                        placeholder="Paste image URL here..."
                      />
                      <div className="flex flex-col items-center justify-center py-2">
                        {linkModal.isUploading ? (
                          <Loader2 className="w-6 h-6 text-primary animate-spin mb-2" />
                        ) : (
                          <UploadCloud className="w-6 h-6 text-slate-400 mb-2" />
                        )}
                        <p className="text-xs text-slate-500">
                          <span className="font-semibold text-primary cursor-pointer hover:underline relative">
                            Upload an image
                            <input 
                              type="file" 
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                              accept="image/*"
                              onChange={(e) => e.target.files?.[0] && handleLinkImageUpload(e.target.files[0])}
                              disabled={linkModal.isUploading}
                            />
                          </span>
                          {' '}or drag & drop
                        </p>
                      </div>
                    </>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 leading-tight pt-1">
                  If left empty, an automatic screenshot of the website will be generated on hover.
                </p>
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => setLinkModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={insertCustomLink}
                className="px-5 py-2 text-sm font-semibold bg-primary text-white hover:bg-primary-600 rounded-lg shadow-sm transition-colors flex items-center"
              >
                Insert Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
