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
        setFaqs(data.slice(0, 5));
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
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
          <div className="text-center mb-12">
            <div className="h-10 w-72 bg-slate-100 rounded-xl mx-auto animate-pulse" />
            <div className="h-5 w-96 bg-slate-50 rounded-lg mx-auto mt-4 animate-pulse" />
          </div>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
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
    <section className="py-16 sm:py-24 bg-slate-50/70 border-t border-slate-200/60">
      <div className="max-w-4xl mx-auto px-6 sm:px-8 lg:px-12">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-extrabold text-slate-900 sm:text-4xl tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600">
            Everything you need to know about bidding, MSTC catalog syncing, and document verification.
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div 
                key={faq.id} 
                className={clsx(
                  "border rounded-2xl overflow-hidden transition-all duration-200",
                  isOpen 
                    ? "border-primary/40 bg-primary/5 shadow-md shadow-primary/5" 
                    : "border-slate-200/80 bg-white hover:border-slate-300"
                )}
              >
                <button
                  className="w-full px-6 py-5 flex justify-between items-center text-left focus:outline-none cursor-pointer"
                  onClick={() => toggleFaq(index)}
                  aria-expanded={isOpen}
                >
                  <span className="font-bold text-slate-900 text-base pr-6">{faq.question}</span>
                  <div className={clsx(
                    "p-2 rounded-xl transition-colors shrink-0",
                    isOpen ? "bg-primary/10 text-primary" : "bg-slate-100 text-slate-400"
                  )}>
                    {isOpen ? (
                      <ChevronUp className="w-5 h-5" />
                    ) : (
                      <ChevronDown className="w-5 h-5" />
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


      </div>
    </section>
  );
}
