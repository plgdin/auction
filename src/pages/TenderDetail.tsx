// @ts-nocheck
import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  FileText, Download, CheckCircle2, 
  ArrowRight, Activity, Building, Clock
} from 'lucide-react';
import { tenderService } from '../services/tenderService';
import { useAuthStore } from '../store/authStore';
import { TenderSubmissionModal } from '../components/tender/TenderSubmissionModal';
import type { Tender, TenderDocument } from '../types/database.types';
import clsx from 'clsx';

export function TenderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  
  const [tender, setTender] = useState<Tender | null>(null);
  const [documents, setDocuments] = useState<TenderDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false); // To mock state after submission

  useEffect(() => {
    async function loadData() {
      if (!id) return;
      setIsLoading(true);
      
      const tenderData = await tenderService.getTenderById(id);
      if (!tenderData) {
        navigate('/not-found');
        return;
      }
      setTender(tenderData);
      
      // We would fetch documents here, or use the joined data if available
      if ((tenderData as any).tender_documents) {
        setDocuments((tenderData as any).tender_documents);
      }
      
      setIsLoading(false);
    }
    loadData();
  }, [id, navigate]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh] bg-slate-50">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!tender) return null;

  const isOpen = tender.status === 'open';

  return (
    <div className="bg-slate-50 min-h-screen pb-20">
      {/* Reverse Auction Placeholder Banner */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8 flex items-center justify-center text-sm font-medium">
          <Activity className="w-4 h-4 mr-2 text-blue-300" />
          This e-Tender is configured for a Forward/Reverse Auction phase following technical evaluation.
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header Block */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 mb-8">
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-6">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="inline-flex items-center px-3 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-700 uppercase tracking-wider font-mono border border-slate-200">
                  REF: {tender.reference_number}
                </span>
                <span className={clsx(
                  "px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full",
                  tender.status === 'open' ? "bg-green-100 text-green-700" :
                  tender.status === 'under_evaluation' ? "bg-amber-100 text-amber-700" :
                  tender.status === 'awarded' ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-700"
                )}>
                  {tender.status.replace('_', ' ')}
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 leading-tight">
                {tender.title}
              </h1>
            </div>
            
            <div className="shrink-0">
              {hasSubmitted ? (
                <div className="flex items-center justify-center px-6 py-3 bg-green-50 border border-green-200 text-green-700 rounded-xl font-bold">
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                  Successfully Submitted
                </div>
              ) : isOpen ? (
                <button 
                  onClick={() => isAuthenticated ? setIsModalOpen(true) : navigate('/auth/login', { state: { from: `/tenders/${tender.id}` }})}
                  className="w-full md:w-auto flex justify-center items-center px-8 py-4 border border-transparent text-base font-bold rounded-xl text-white bg-primary hover:bg-primary-700 shadow-lg shadow-primary/30 transition-all"
                >
                  Submit Tender
                </button>
              ) : (
                <div className="flex items-center justify-center px-6 py-3 bg-slate-100 border border-slate-200 text-slate-500 rounded-xl font-bold">
                  Submission Closed
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t border-slate-100">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Published</p>
              <p className="text-sm font-semibold text-slate-900">{new Date(tender.created_at).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Submission Deadline</p>
              <p className="text-sm font-bold text-red-600 flex items-center">
                <Clock className="w-4 h-4 mr-1" />
                {new Date(tender.submission_deadline).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">EMD Amount</p>
              <p className="text-sm font-bold text-slate-900">₹{tender.emd_amount.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Document Fee</p>
              <p className="text-sm font-bold text-slate-900">₹{tender.document_fee.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Description */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
              <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center">
                <FileText className="w-5 h-5 mr-2 text-primary" /> Scope of Work
              </h2>
              <div className="prose prose-slate max-w-none text-slate-600 whitespace-pre-line">
                {tender.description || 'No detailed scope of work provided for this tender.'}
              </div>
            </div>

            {/* Documents */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
              <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center">
                <Download className="w-5 h-5 mr-2 text-primary" /> Tender Documents
              </h2>
              
              {documents.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <p className="text-slate-500 font-medium">No documents attached to this tender yet.</p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {documents.map((doc) => (
                    <li key={doc.id} className="py-4 flex items-center justify-between group">
                      <div className="flex items-start">
                        <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center text-red-500 mr-4 shrink-0">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 group-hover:text-primary transition-colors">{doc.name}</p>
                          <p className="text-xs text-slate-500 uppercase tracking-wider mt-0.5">{doc.file_type || 'PDF'} Document</p>
                        </div>
                      </div>
                      <a href={doc.file_url} target="_blank" rel="noreferrer" className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors">
                        <Download className="w-5 h-5" />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-8">
            
            {/* Status Timeline */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-6">Tender Timeline</h3>
              <div className="relative border-l-2 border-slate-100 ml-3 space-y-6">
                
                <div className="relative">
                  <div className="absolute -left-[21px] bg-white p-1 rounded-full">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  </div>
                  <div className="pl-6">
                    <p className="text-sm font-bold text-slate-900">Published</p>
                    <p className="text-xs text-slate-500">{new Date(tender.created_at).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute -left-[21px] bg-white p-1 rounded-full">
                    <div className={clsx("w-3 h-3 rounded-full", isOpen ? "bg-primary animate-pulse" : "bg-green-500")}></div>
                  </div>
                  <div className="pl-6">
                    <p className="text-sm font-bold text-slate-900">Submission Open</p>
                    <p className="text-xs text-slate-500">Currently accepting bids</p>
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute -left-[21px] bg-white p-1 rounded-full">
                    <div className={clsx("w-3 h-3 rounded-full", tender.status === 'under_evaluation' ? "bg-primary animate-pulse" : tender.status === 'awarded' ? "bg-green-500" : "bg-slate-200")}></div>
                  </div>
                  <div className="pl-6">
                    <p className="text-sm font-bold text-slate-900">Technical Evaluation</p>
                    <p className="text-xs text-slate-500">TBD</p>
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute -left-[21px] bg-white p-1 rounded-full">
                    <div className={clsx("w-3 h-3 rounded-full", tender.status === 'awarded' ? "bg-green-500" : "bg-slate-200")}></div>
                  </div>
                  <div className="pl-6">
                    <p className="text-sm font-bold text-slate-900">Awarded</p>
                    <p className="text-xs text-slate-500">Contract Finalization</p>
                  </div>
                </div>

              </div>
            </div>

            {/* Issuer Info */}
            <div className="bg-slate-900 text-white rounded-2xl shadow-sm p-6 relative overflow-hidden">
              <Building className="absolute -right-6 -bottom-6 w-32 h-32 text-white/5" />
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 relative z-10">Issuing Authority</h3>
              <p className="text-lg font-bold mb-1 relative z-10">Lelam Procurement</p>
              <p className="text-sm text-slate-300 mb-4 relative z-10">Ministry of Enterprise Affairs</p>
              <Link to="/contact" className="text-primary-300 text-sm font-bold hover:underline relative z-10 flex items-center">
                Contact Support <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </div>

          </div>

        </div>
      </div>

      <TenderSubmissionModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        tender={tender}
        onSuccess={() => {
          setHasSubmitted(true);
        }}
      />
    </div>
  );
}
