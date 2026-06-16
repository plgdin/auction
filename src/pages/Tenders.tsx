import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Filter, Calendar, FileText, ArrowRight, IndianRupee, Clock } from 'lucide-react';
import { tenderService } from '../services/tenderService';
import type { Tender } from '../types/database.types';
import clsx from 'clsx';

function TenderCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col animate-pulse h-full shadow-sm">
      <div className="p-6 border-b border-slate-100 flex-grow space-y-4">
        <div className="flex justify-between items-start">
          <div className="h-4 bg-slate-200 rounded w-1/4" />
          <div className="h-4 bg-slate-200 rounded w-16" />
        </div>
        <div className="space-y-2">
          <div className="h-5 bg-slate-250 rounded w-3/4" />
          <div className="h-5 bg-slate-200 rounded w-1/2" />
        </div>
        <div className="h-4 bg-slate-200 rounded w-full" />
        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-2">
            <div className="h-3 bg-slate-200 rounded w-1/3" />
            <div className="h-4 bg-slate-200 rounded w-2/3" />
          </div>
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-2">
            <div className="h-3 bg-slate-200 rounded w-1/3" />
            <div className="h-4 bg-slate-200 rounded w-2/3" />
          </div>
        </div>
      </div>
      <div className="p-4 bg-slate-50 flex items-center justify-between">
        <div className="h-4 bg-slate-200 rounded w-1/3" />
        <div className="h-8 bg-slate-200 rounded w-28" />
      </div>
    </div>
  );
}

export function Tenders() {
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    async function loadTenders() {
      setIsLoading(true);
      const filters: any = {};
      if (statusFilter !== 'all') filters.status = statusFilter;
      if (searchTerm) filters.search = searchTerm;
      
      const data = await tenderService.getTenders(filters);
      setTenders(data);
      setIsLoading(false);
    }
    
    // Add a slight debounce for search
    const timeoutId = setTimeout(() => {
      loadTenders();
    }, 300);
    
    return () => clearTimeout(timeoutId);
  }, [statusFilter, searchTerm]);

  return (
    <div className="bg-slate-50 min-h-screen py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header Section */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-4">
            Active e-Tenders
          </h1>
          <p className="text-lg text-slate-600">
            Browse and participate in high-value procurement opportunities. Submit technical and financial bids securely.
          </p>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-8 flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Search by Title or Reference Number..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
            />
          </div>
          <div className="flex gap-4">
            <div className="relative flex-1 md:w-48">
              <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 pointer-events-none" />
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full pl-12 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary cursor-pointer font-medium text-slate-700"
              >
                <option value="all">All Statuses</option>
                <option value="open">Open</option>
                <option value="under_evaluation">Under Evaluation</option>
                <option value="awarded">Awarded</option>
              </select>
            </div>
          </div>
        </div>

        {/* Results Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[...Array(4)].map((_, i) => (
              <TenderCardSkeleton key={i} />
            ))}
          </div>
        ) : tenders.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-slate-200">
            <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-900 mb-2">No Tenders Found</h3>
            <p className="text-slate-500">Try adjusting your search criteria or filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {tenders.map((tender) => (
              <div key={tender.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 hover:shadow-lg transition-shadow overflow-hidden flex flex-col">
                <div className="p-6 border-b border-slate-100 flex-grow">
                  <div className="flex justify-between items-start mb-4">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-600 uppercase tracking-wider font-mono">
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
                  
                  <h3 className="text-xl font-bold text-slate-900 mb-2 line-clamp-2">
                    {tender.title}
                  </h3>
                  
                  <p className="text-sm text-slate-500 line-clamp-2 mb-6">
                    {tender.description || 'No description provided.'}
                  </p>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                      <p className="text-xs font-bold text-slate-400 uppercase mb-1 flex items-center">
                        <Clock className="w-3 h-3 mr-1" /> Deadline
                      </p>
                      <p className="text-sm font-bold text-slate-900">
                        {new Date(tender.submission_deadline).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                      <p className="text-xs font-bold text-slate-400 uppercase mb-1 flex items-center">
                        <IndianRupee className="w-3 h-3 mr-1" /> EMD Amount
                      </p>
                      <p className="text-sm font-bold text-slate-900">
                        ₹{tender.emd_amount.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 bg-slate-50 flex items-center justify-between">
                  <div className="flex items-center text-xs text-slate-500 font-medium">
                    <Calendar className="w-4 h-4 mr-1.5" />
                    Published: {new Date(tender.created_at).toLocaleDateString()}
                  </div>
                  <Link 
                    to={`/tenders/${tender.id}`}
                    className="inline-flex items-center px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50 hover:text-primary hover:border-primary transition-colors"
                  >
                    View Details <ArrowRight className="ml-2 w-4 h-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
