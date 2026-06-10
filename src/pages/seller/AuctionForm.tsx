import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Save, Image as ImageIcon, UploadCloud, X, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { auctionService } from '../../services/auctionService';
import { storageService } from '../../services/storageService';
import type { Auction } from '../../types/database.types';

const auctionSchema = z.object({
  title: z.string().min(10, 'Title must be at least 10 characters'),
  description: z.string().min(50, 'Description must be at least 50 characters'),
  starting_price: z.number().min(1, 'Starting price must be greater than 0'),
  reserve_price: z.number().optional(),
  bid_increment: z.number().min(1, 'Bid increment must be greater than 0'),
  emd_amount: z.number().min(0, 'EMD amount cannot be negative'),
  start_time: z.string().min(1, 'Start time is required'),
  end_time: z.string().min(1, 'End time is required'),
});

type AuctionValues = z.infer<typeof auctionSchema>;

export function AuctionForm() {
  const { id } = useParams<{ id: string }>();
  const isEditing = !!id;
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // File Upload State
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<AuctionValues>({
    resolver: zodResolver(auctionSchema),
  });

  useEffect(() => {
    if (isEditing && id) {
      // Load existing auction data
      auctionService.getAuctionById(id).then((data) => {
        if (data) {
          reset({
            title: data.title,
            description: data.description || '',
            starting_price: data.starting_price,
            reserve_price: data.reserve_price,
            bid_increment: data.bid_increment,
            emd_amount: data.emd_amount,
            // Format dates for datetime-local input
            start_time: new Date(data.start_time).toISOString().slice(0, 16),
            end_time: new Date(data.end_time).toISOString().slice(0, 16),
          });
        }
      });
    }
  }, [id, isEditing, reset]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const onSubmit = async (data: AuctionValues) => {
    if (!user) return;
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      let imageUrl = null;
      if (imageFile) {
        imageUrl = await storageService.uploadAuctionImage(imageFile);
      }

      const auctionPayload: Partial<Auction> = {
        title: data.title,
        description: data.description,
        starting_price: data.starting_price,
        reserve_price: data.reserve_price,
        bid_increment: data.bid_increment,
        emd_amount: data.emd_amount,
        start_time: new Date(data.start_time).toISOString(),
        end_time: new Date(data.end_time).toISOString(),
        seller_id: user.id,
        status: 'draft', // New auctions start as draft
      };

      if (isEditing && id) {
        // We would update here, but our service only has create for now
        // await auctionService.updateAuction(id, auctionPayload);
        // For now, we simulate success
      } else {
        const newAuction = await auctionService.createAuction(auctionPayload);
        if (newAuction && imageUrl) {
          // If we had an image service, we'd insert the image record linked to newAuction.id
        }
      }

      navigate('/seller/auctions');
    } catch (err) {
      setErrorMsg('Failed to save auction.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate('/seller/auctions')} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {isEditing ? 'Edit Auction' : 'Create New Auction'}
          </h1>
          <p className="text-slate-500 text-sm">Configure the details, pricing, and assets for your listing.</p>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 text-red-700 p-4 rounded-xl text-sm border border-red-200">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        
        {/* Basic Info */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-bold text-slate-900 mb-4 border-b border-slate-100 pb-2">Basic Information</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Auction Title</label>
              <input
                type="text"
                {...register('title')}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                placeholder="e.g., 2018 Caterpillar Excavator"
              />
              {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>}
            </div>
            
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Description</label>
              <textarea
                {...register('description')}
                rows={5}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary resize-none"
                placeholder="Provide a detailed description of the asset..."
              />
              {errors.description && <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>}
            </div>
          </div>
        </div>

        {/* Pricing & Dates */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-bold text-slate-900 mb-4 border-b border-slate-100 pb-2">Pricing & Schedule</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Starting Price (₹)</label>
              <input
                type="number"
                {...register('starting_price', { valueAsNumber: true })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              />
              {errors.starting_price && <p className="mt-1 text-sm text-red-600">{errors.starting_price.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Reserve Price (₹) - Optional</label>
              <input
                type="number"
                {...register('reserve_price', { valueAsNumber: true })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Bid Increment (₹)</label>
              <input
                type="number"
                {...register('bid_increment', { valueAsNumber: true })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              />
              {errors.bid_increment && <p className="mt-1 text-sm text-red-600">{errors.bid_increment.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">EMD Required (₹)</label>
              <input
                type="number"
                {...register('emd_amount', { valueAsNumber: true })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              />
              {errors.emd_amount && <p className="mt-1 text-sm text-red-600">{errors.emd_amount.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Start Time</label>
              <input
                type="datetime-local"
                {...register('start_time')}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              />
              {errors.start_time && <p className="mt-1 text-sm text-red-600">{errors.start_time.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">End Time</label>
              <input
                type="datetime-local"
                {...register('end_time')}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              />
              {errors.end_time && <p className="mt-1 text-sm text-red-600">{errors.end_time.message}</p>}
            </div>
          </div>
        </div>

        {/* Media Upload */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-bold text-slate-900 mb-4 border-b border-slate-100 pb-2 flex items-center">
            <ImageIcon className="w-5 h-5 mr-2 text-primary" /> Cover Image
          </h2>
          
          <div className="flex items-start gap-6">
            <div className="flex-1">
              <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-slate-300 border-dashed rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <UploadCloud className="w-8 h-8 mb-3 text-slate-400" />
                  <p className="mb-2 text-sm text-slate-500 font-semibold">Click to upload image</p>
                  <p className="text-xs text-slate-400">PNG, JPG or WEBP (Max 5MB)</p>
                </div>
                <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
              </label>
            </div>
            {imagePreview && (
              <div className="shrink-0 relative w-48 h-48 rounded-xl overflow-hidden border border-slate-200">
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                <button 
                  type="button" 
                  onClick={() => { setImageFile(null); setImagePreview(null); }}
                  className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-4 pt-4">
          <button
            type="button"
            onClick={() => navigate('/seller/auctions')}
            className="px-6 py-3 text-sm font-bold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-8 py-3 text-sm font-bold text-white bg-primary rounded-xl hover:bg-primary-700 disabled:opacity-50 flex items-center shadow-md transition-colors"
          >
            {isSubmitting ? 'Saving...' : <><Save className="w-4 h-4 mr-2" /> Save Auction</>}
          </button>
        </div>
      </form>
    </div>
  );
}
