import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Calendar, ArrowRight } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { formatPrice } from '../../utils/currency';
import { tenderService } from '../../services/tenderService';
import type { Tender } from '../../types/database.types';

export function FeaturedTendersSection() {
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { currency } = useAppStore();

  useEffect(() => {
    async function loadTenders() {
      // Fetch open tenders, limit to 3
      const data = await tenderService.getTenders({ status: 'open' });
      setTenders(data.slice(0, 3));
      setIsLoading(false);
    }
    loadTenders();
  }, []);

  return (
    <section className="py-24 bg-white border-t border-slate-200/60">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
          <div>
            <h2 className="text-3xl font-extrabold text-slate-900 sm:text-4xl tracking-tight">Featured Open Tenders</h2>
            <p className="mt-4 text-base sm:text-lg text-slate-600 max-w-2xl leading-relaxed">
              Discover and bid on high-value procurement opportunities.
            </p>
          </div>
          <Link to="/tenders" className="hidden sm:inline-flex items-center text-sm font-bold text-slate-700 hover:text-primary transition-colors shrink-0">
            Browse All Tenders <ArrowRight className="ml-2 w-5 h-5" />
          </Link>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : tenders.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200 p-8">
            <h3 className="text-lg font-bold text-slate-900">No open tenders available.</h3>
            <p className="mt-2 text-slate-600">Please check back later.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {tenders.map((tender) => (
              <div key={tender.id} className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200/80 shadow-2xs hover:shadow-xl hover:border-primary/40 transition-all duration-300 flex flex-col sm:flex-row gap-6 items-start sm:items-center group">
                <div className="flex-shrink-0 w-14 h-14 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all duration-300">
                  <FileText className="w-8 h-8" />
                </div>
                <div className="flex-grow">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs font-bold bg-primary/10 text-primary px-2.5 py-1 rounded-full border border-primary/20 uppercase tracking-wide">
                      {tender.reference_number}
                    </span>
                    <span className="text-xs font-semibold text-slate-500 font-mono">
                      EMD: {formatPrice(tender.emd_amount, currency)}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-primary transition-colors">{tender.title}</h3>
                  <p className="text-slate-500 text-sm line-clamp-2 sm:line-clamp-1 mb-4 sm:mb-0 leading-relaxed">
                    {tender.description}
                  </p>
                </div>
                <div className="flex-shrink-0 w-full sm:w-auto flex flex-col sm:items-end border-t sm:border-t-0 sm:border-l border-slate-200/60 pt-4 sm:pt-0 sm:pl-6">
                  <div className="flex items-center text-sm text-slate-500 mb-4">
                    <Calendar className="w-4 h-4 mr-2" />
                    Due: {new Date(tender.submission_deadline).toLocaleDateString()}
                  </div>
                  <Link 
                    to={`/tenders/${tender.id}`}
                    className="w-full sm:w-auto inline-flex justify-center items-center px-6 py-2.5 border border-primary text-sm font-bold rounded-xl text-primary bg-transparent hover:bg-primary hover:text-white transition-all duration-300"
                  >
                    Submit Bid
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
        
        <div className="mt-8 sm:hidden flex justify-center">
          <Link to="/tenders" className="inline-flex items-center px-6 py-3 border border-slate-300 shadow-sm text-base font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50">
            Browse All Tenders
          </Link>
        </div>
      </div>
    </section>
  );
}
