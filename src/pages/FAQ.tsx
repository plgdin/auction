import { useEffect, useState } from 'react';
import { publicService } from '../services/publicService';
import type { FaqItem } from '../types/database.types';
import { ChevronDown, ChevronUp, Search, HelpCircle, Building2, Smartphone } from 'lucide-react';
import clsx from 'clsx';

export function FAQ() {
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [activeTab, setActiveTab] = useState<'mstc' | 'lelam'>('mstc');
  const [searchQuery, setSearchQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    document.title = 'eAuctions Help & FAQ | Lelam';
    async function loadFaqs() {
      const data = await publicService.getActiveFaqs();
      setFaqs(data);
      setIsLoading(false);
    }
    loadFaqs();
  }, []);

  const toggleFaq = (id: string) => {
    setOpenId(openId === id ? null : id);
  };

  // Filter FAQs based on active tab and search query
  const displayedFaqs = faqs.filter((faq) => {
    // Normalise category checking
    const faqCategory = faq.category?.toLowerCase() === 'lelam' ? 'lelam' : 'mstc';
    if (faqCategory !== activeTab) return false;

    if (!searchQuery.trim()) return true;

    const lowerQuery = searchQuery.toLowerCase();
    return (
      faq.question.toLowerCase().includes(lowerQuery) ||
      faq.answer.toLowerCase().includes(lowerQuery)
    );
  });

  // Generate structured FAQPage schema for search engine crawlers
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": displayedFaqs.map((faq) => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  };

  return (
    <div className="bg-slate-50 min-h-screen py-16">
      {/* Dynamic JSON-LD Structured Data for Crawlers */}
      {!isLoading && displayedFaqs.length > 0 && (
        <script type="application/ld+json">
          {JSON.stringify(faqSchema)}
        </script>
      )}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
        
        {/* Title / Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center p-3 bg-blue-50 text-primary rounded-2xl mb-4 shadow-xs">
            <HelpCircle className="w-8 h-8" />
          </div>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight sm:text-5xl">eAuctions Help & FAQ</h1>
          <p className="mt-4 text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto">
            Find answers to frequently asked questions about MSTC eAuctions and the Lelam eAuction bidding assistant platform.
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative max-w-2xl mx-auto mb-10">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-12 pr-4 py-4 border border-slate-200 rounded-2xl leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary sm:text-lg shadow-sm transition-all"
            placeholder="Search questions or keywords..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Tab Buttons */}
        <div className="flex p-1.5 bg-slate-200/60 rounded-2xl max-w-md mx-auto mb-12 shadow-xs">
          <button
            onClick={() => {
              setActiveTab('mstc');
              setOpenId(null);
            }}
            className={clsx(
              "flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-xl transition-all duration-200 cursor-pointer",
              activeTab === 'mstc'
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Building2 className="w-4 h-4" />
            MSTC eAuctions
          </button>
          <button
            onClick={() => {
              setActiveTab('lelam');
              setOpenId(null);
            }}
            className={clsx(
              "flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-xl transition-all duration-200 cursor-pointer",
              activeTab === 'lelam'
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Smartphone className="w-4 h-4" />
            Lelam Platform
          </button>
        </div>

        {/* FAQ list */}
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
          </div>
        ) : displayedFaqs.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-350 p-6">
            <p className="text-lg font-medium text-slate-500">No matches found for "{searchQuery}".</p>
            <button
              onClick={() => setSearchQuery('')}
              className="mt-4 px-4 py-2 text-sm font-semibold text-primary hover:text-primary-600 bg-primary/5 hover:bg-primary/10 rounded-lg transition-colors cursor-pointer"
            >
              Clear Search
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {displayedFaqs.map((faq) => {
              const isOpen = openId === faq.id;
              return (
                <div
                  key={faq.id}
                  className={clsx(
                    "bg-white border rounded-2xl overflow-hidden transition-all duration-300",
                    isOpen 
                      ? "border-primary/30 shadow-md ring-1 ring-primary/5" 
                      : "border-slate-200 hover:border-slate-300 hover:shadow-xs"
                  )}
                >
                  <button
                    className="w-full px-6 py-5 flex justify-between items-center text-left focus:outline-none focus:bg-slate-50/50 cursor-pointer"
                    onClick={() => toggleFaq(faq.id)}
                    aria-expanded={isOpen}
                  >
                    <span className="font-bold text-base sm:text-lg text-slate-900 pr-4">{faq.question}</span>
                    <span className="p-1 bg-slate-100 rounded-lg text-slate-500 flex-shrink-0 group-hover:bg-slate-200 transition-colors">
                      {isOpen ? (
                        <ChevronUp className="w-5 h-5 text-primary" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </span>
                  </button>

                  <div
                    className={clsx(
                      "transition-all duration-300 ease-in-out overflow-hidden",
                      isOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
                    )}
                  >
                    <div className="px-6 pb-6">
                      <div className="w-full h-px bg-slate-100 mb-4" />
                      <p className="text-slate-600 text-sm sm:text-base leading-relaxed whitespace-pre-line">
                        {faq.answer}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
