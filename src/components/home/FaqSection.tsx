import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { FaqItem } from '../../types/database.types';
import clsx from 'clsx';

export function FaqSection() {
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchFaqs() {
      try {
        const { publicService } = await import('../../services/publicService');
        const data = await publicService.getActiveFaqs();
        setFaqs(data.slice(0, 8));
      } catch (e) {
        console.error('Error fetching FAQs:', e);
      } finally {
        setIsLoading(false);
      }
    }
    fetchFaqs();
  }, []);

  const toggleFaq = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  if (isLoading) {
    return (
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="h-10 w-72 bg-slate-100 rounded-xl mx-auto animate-pulse" />
            <div className="h-5 w-96 bg-slate-50 rounded-lg mx-auto mt-4 animate-pulse" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="border border-slate-200 rounded-2xl p-6">
                <div className="h-5 bg-slate-100 rounded w-3/4 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (faqs.length === 0) return null;

  return (
    <section className="py-20 lg:py-28 bg-slate-50/70 border-t border-slate-200/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-14 lg:mb-16">
          <h2 className="text-3xl font-extrabold text-slate-900 sm:text-4xl lg:text-5xl tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600">
            Everything you need to know about bidding, MSTC catalog syncing, document verification, and Lelam features.
          </p>
        </div>

        {/* Desktop 2-Column Staggered Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 items-start">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div 
                key={faq.id} 
                className={clsx(
                  "border rounded-2xl overflow-hidden transition-all duration-300",
                  isOpen 
                    ? "border-primary/40 bg-white shadow-lg shadow-primary/5 ring-1 ring-primary/20" 
                    : "border-slate-200/80 bg-white hover:border-primary/30 hover:shadow-md"
                )}
              >
                <button
                  className="w-full px-6 py-5 flex justify-between items-center text-left focus:outline-none cursor-pointer group"
                  onClick={() => toggleFaq(index)}
                  aria-expanded={isOpen}
                >
                  <span className="font-bold text-slate-900 text-base pr-4 leading-snug">{faq.question}</span>
                  <div className={clsx(
                    "p-2 rounded-xl transition-colors shrink-0",
                    isOpen ? "bg-primary text-white" : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"
                  )}>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 stroke-[2.5]" />
                    ) : (
                      <ChevronDown className="w-4 h-4 stroke-[2.5]" />
                    )}
                  </div>
                </button>
                
                <div 
                  className={clsx(
                    "px-6 overflow-hidden transition-all duration-300 ease-in-out",
                    isOpen ? "max-h-96 pb-6 opacity-100" : "max-h-0 opacity-0"
                  )}
                >
                  <p className="text-slate-600 text-sm leading-relaxed border-t border-slate-100 pt-4">
                    {faq.answer}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-center mt-12">
          <a
            href="/faq"
            className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:text-primary-600 transition-colors"
          >
            Have more questions? View full FAQ directory →
          </a>
        </div>
      </div>
    </section>
  );
}
