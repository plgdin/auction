import { useEffect, useState } from 'react';
import { publicService } from '../services/publicService';
import type { FaqItem } from '../types/database.types';
import { ChevronDown, ChevronUp, Search, HelpCircle } from 'lucide-react';
import clsx from 'clsx';

export function FAQ() {
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [filteredFaqs, setFilteredFaqs] = useState<FaqItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [openIndex, setOpenIndex] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadFaqs() {
      const data = await publicService.getActiveFaqs();
      setFaqs(data);
      setFilteredFaqs(data);
      setIsLoading(false);
    }
    loadFaqs();
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredFaqs(faqs);
    } else {
      const lowerQuery = searchQuery.toLowerCase();
      setFilteredFaqs(
        faqs.filter(
          (faq) =>
            faq.question.toLowerCase().includes(lowerQuery) ||
            faq.answer.toLowerCase().includes(lowerQuery)
        )
      );
    }
  }, [searchQuery, faqs]);

  const toggleFaq = (id: string) => {
    setOpenIndex(openIndex === id ? null : id);
  };

  return (
    <div className="bg-slate-50 min-h-screen py-16">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
        <div className="text-center mb-12">
          <HelpCircle className="w-12 h-12 text-primary mx-auto mb-4" />
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">How can we help?</h1>
          <p className="mt-4 text-xl text-slate-600">
            Search our knowledge base or browse frequently asked questions below.
          </p>
        </div>

        <div className="relative max-w-2xl mx-auto mb-16">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-6 w-6 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-12 pr-4 py-4 border border-slate-300 rounded-xl leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary sm:text-lg shadow-sm transition-shadow"
            placeholder="Search for answers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : filteredFaqs.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
            <p className="text-lg text-slate-500">No results found for "{searchQuery}".</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredFaqs.map((faq) => {
              const isOpen = openIndex === faq.id;
              return (
                <div 
                  key={faq.id} 
                  className={clsx(
                    "bg-white border rounded-xl overflow-hidden transition-all duration-200",
                    isOpen ? "border-primary/30 shadow-md ring-1 ring-primary/20" : "border-slate-200 hover:border-slate-300 hover:shadow-sm"
                  )}
                >
                  <button
                    className="w-full px-6 py-5 flex justify-between items-center focus:outline-none focus:bg-slate-50"
                    onClick={() => toggleFaq(faq.id)}
                    aria-expanded={isOpen}
                  >
                    <span className="font-semibold text-lg text-slate-900 text-left pr-8">{faq.question}</span>
                    {isOpen ? (
                      <ChevronUp className="w-6 h-6 text-primary flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-6 h-6 text-slate-400 flex-shrink-0" />
                    )}
                  </button>
                  
                  <div 
                    className={clsx(
                      "px-6 overflow-hidden transition-all duration-300 ease-in-out",
                      isOpen ? "max-h-96 pb-6 opacity-100" : "max-h-0 opacity-0"
                    )}
                  >
                    <div className="w-full h-px bg-slate-100 mb-4"></div>
                    <p className="text-slate-600 text-base leading-relaxed">
                      {faq.answer}
                    </p>
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
