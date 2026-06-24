import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';
import type { FaqItem } from '../../types/database.types';
import clsx from 'clsx';

export function FaqSection() {
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchFaqs() {
      try {
        // Dynamic import to avoid parsing the full publicService + NLP search chain on initial load
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

  // Show skeleton while loading to prevent CLS (returning null would cause layout shift)
  if (isLoading) {
    return (
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          <div className="text-center mb-12">
            <div className="h-10 w-80 bg-slate-100 rounded-lg mx-auto animate-pulse" />
            <div className="h-5 w-96 bg-slate-50 rounded mx-auto mt-4 animate-pulse" />
          </div>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="border border-slate-200 rounded-xl p-6">
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
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl flex items-center justify-center">
            <HelpCircle className="w-8 h-8 text-primary mr-3" />
            Frequently Asked Questions
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            Quick answers to common questions about bidding, registration, and payments.
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div 
                key={faq.id} 
                className={clsx(
                  "border rounded-xl overflow-hidden transition-all duration-200",
                  isOpen ? "border-primary/30 bg-primary/5 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300"
                )}
              >
                <button
                  className="w-full px-6 py-4 flex justify-between items-center focus:outline-none"
                  onClick={() => toggleFaq(index)}
                  aria-expanded={isOpen}
                >
                  <span className="font-semibold text-slate-900 text-left pr-8">{faq.question}</span>
                  {isOpen ? (
                    <ChevronUp className="w-5 h-5 text-primary flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />
                  )}
                </button>
                
                <div 
                  className={clsx(
                    "px-6 overflow-hidden transition-all duration-300 ease-in-out",
                    isOpen ? "max-h-96 pb-5 opacity-100" : "max-h-0 opacity-0"
                  )}
                >
                  <p className="text-slate-600 text-sm leading-relaxed">
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

