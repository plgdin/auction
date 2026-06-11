import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Calendar, ArrowRight } from 'lucide-react';
import { tenderService } from '../../services/tenderService';
import type { Tender } from '../../types/database.types';

export function FeaturedTendersSection() {
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
    <section className="py-20 bg-slate-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-end mb-12 border-b border-slate-200 pb-6">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">Featured Open Tenders</h2>
            <p className="mt-4 text-lg text-slate-600">
              Discover and bid on high-value procurement opportunities.
            </p>
          </div>
          <Link to="/tenders" className="hidden sm:flex items-center text-primary font-semibold hover:text-primary-700">
            Browse All Tenders <ArrowRight className="ml-2 w-5 h-5" />
          </Link>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : tenders.length === 0 ? (
          <div className="text-center py-12 bg-white rounded border border-dashed border-border">
            <h3 className="text-lg font-bold text-foreground">No open tenders available.</h3>
            <p className="mt-2 text-muted-foreground">Please check back later.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {tenders.map((tender) => (
              <div key={tender.id} className="bg-white p-6 sm:p-8 rounded shadow-sm border border-border hover:border-primary/50 transition-colors flex flex-col sm:flex-row gap-6 items-start sm:items-center">
                <div className="flex-shrink-0 w-16 h-16 bg-primary/10 rounded flex items-center justify-center text-primary">
                  <FileText className="w-8 h-8" />
                </div>
                <div className="flex-grow">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs font-bold bg-primary/20 text-primary px-2.5 py-0.5 rounded uppercase tracking-wide">
                      {tender.reference_number}
                    </span>
                    <span className="text-xs font-semibold text-muted-foreground">
                      EMD: ₹{tender.emd_amount.toLocaleString()}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-2">{tender.title}</h3>
                  <p className="text-muted-foreground text-sm line-clamp-2 sm:line-clamp-1 mb-4 sm:mb-0">
                    {tender.description}
                  </p>
                </div>
                <div className="flex-shrink-0 w-full sm:w-auto flex flex-col sm:items-end border-t sm:border-t-0 sm:border-l border-border pt-4 sm:pt-0 sm:pl-6">
                  <div className="flex items-center text-sm text-muted-foreground mb-4">
                    <Calendar className="w-4 h-4 mr-2" />
                    Due: {new Date(tender.submission_deadline).toLocaleDateString()}
                  </div>
                  <Link 
                    to={`/tenders/${tender.id}`}
                    className="w-full sm:w-auto inline-flex justify-center items-center px-6 py-2.5 border border-primary text-sm font-medium rounded text-primary bg-transparent hover:bg-primary hover:text-white transition-colors"
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
