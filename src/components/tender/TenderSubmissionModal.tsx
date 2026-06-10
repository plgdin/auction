// @ts-nocheck
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, UploadCloud, AlertCircle, FileText, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from "../../store/authStore";
import { tenderService } from "../../services/tenderService";
import type { Tender } from "../../types/database.types";

const submissionSchema = z.object({
  financialBid: z.number().min(1, 'Financial bid must be greater than 0'),
  technicalDetails: z.string().min(50, 'Please provide detailed technical specifications (min 50 chars)'),
});

type SubmissionValues = z.infer<typeof submissionSchema>;

interface TenderSubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  tender: Tender;
  onSuccess: () => void;
}

export function TenderSubmissionModal({ isOpen, onClose, tender, onSuccess }: TenderSubmissionModalProps) {
  const { user } = useAuthStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const { register, handleSubmit, formState: { errors }, reset } = useForm<SubmissionValues>({
    resolver: zodResolver(submissionSchema),
  });

  if (!isOpen) return null;

  const onSubmit = async (data: SubmissionValues) => {
    if (!user) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    
    try {
      const response = await tenderService.submitTender({
        tender_id: tender.id,
        submitter_id: user.id,
        status: 'submitted',
        financial_bid: data.financialBid,
        technical_details: data.technicalDetails
      });
      
      if (response) {
        reset();
        onSuccess();
        onClose();
      } else {
        setErrorMsg('Failed to submit tender. Please try again.');
      }
    } catch (error) {
      setErrorMsg('An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={!isSubmitting ? onClose : undefined} />
      
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Submit Tender</h3>
            <p className="text-xs font-mono text-slate-500 mt-0.5">REF: {tender.reference_number}</p>
          </div>
          <button onClick={onClose} disabled={isSubmitting} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit(onSubmit)} className="p-6">
          {errorMsg && (
            <div className="mb-6 bg-red-50 text-red-700 p-4 rounded-xl text-sm border border-red-200 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p>{errorMsg}</p>
            </div>
          )}

          <div className="bg-blue-50 text-blue-800 p-4 rounded-xl text-sm border border-blue-200 mb-8 flex items-start gap-3">
            <FileText className="w-5 h-5 shrink-0 mt-0.5 text-blue-600" />
            <div>
              <p className="font-bold mb-1">Two-Cover System (Technical & Financial)</p>
              <p>Your technical details will be evaluated first. Only if technically qualified, your financial bid will be opened. This submission is final.</p>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Technical Proposal Details</label>
              <textarea
                {...register('technicalDetails')}
                rows={6}
                placeholder="Detail your technical capabilities, past experience, and methodology here..."
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary shadow-sm resize-none text-sm"
              />
              {errors.technicalDetails && <p className="mt-1 text-sm text-red-600 font-medium">{errors.technicalDetails.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Technical Documents (Optional Uploads)</label>
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:bg-slate-50 transition-colors cursor-pointer">
                <UploadCloud className="w-8 h-8 text-slate-400 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-700">Click to upload files</p>
                <p className="text-xs text-slate-500 mt-1">PDF, DOCX up to 10MB each</p>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100">
              <label className="block text-sm font-bold text-slate-700 mb-2">Financial Bid (₹)</label>
              <div className="relative max-w-md">
                <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-500 font-bold">₹</span>
                <input
                  type="number"
                  {...register('financialBid', { valueAsNumber: true })}
                  placeholder="Enter total bid amount"
                  className="block w-full pl-8 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary font-bold text-lg"
                />
              </div>
              {errors.financialBid && <p className="mt-1 text-sm text-red-600 font-medium">{errors.financialBid.message}</p>}
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-6 py-3 text-sm font-bold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-8 py-3 text-sm font-bold text-white bg-primary rounded-xl hover:bg-primary-700 disabled:opacity-50 shadow-lg shadow-primary/30 transition-all flex items-center"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                  Submitting Securely...
                </>
              ) : (
                <>
                  Submit Tender <CheckCircle2 className="w-5 h-5 ml-2" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
