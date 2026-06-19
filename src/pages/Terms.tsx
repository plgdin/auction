import { FileText } from 'lucide-react';

export function Terms() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center p-3 bg-primary/10 text-primary rounded-2xl mb-4">
          <FileText className="w-8 h-8" />
        </div>
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Terms & Conditions</h1>
        <p className="text-slate-500 mt-2 text-sm">Effective Date: June 18, 2026</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xs space-y-8 text-slate-700 leading-relaxed">
        <section className="space-y-3">
          <p>
            By registering for or using <strong>Lelam (Auction Central)</strong>, you agree to comply with and be bound by these Terms & Conditions.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-2">1. Scope of Service & MSTC Handoff</h2>
          <ul className="list-disc pl-5 space-y-2 text-sm">
            <li><strong>Discovery & Assistant Only:</strong> Lelam acts strictly as an auction discovery assistant and search engine. It aggregates, renders, and indexes public catalogs from the official MSTC eCommerce website.</li>
            <li><strong>No Direct Bidding/Payments:</strong> Lelam does not host actual bidding, registration, or financial transactions for official auctions.</li>
            <li><strong>Catalog Disclaimer:</strong> While we use AI and OCR to extract quantities, eligibility terms, and contact details from catalog PDFs, all extracted details are for informational purposes. Users must verify all details against the official MSTC PDF before bidding.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-2">2. User Accounts & Security</h2>
          <ul className="list-disc pl-5 space-y-2 text-sm">
            <li><strong>Eligibility:</strong> You must provide accurate and complete registration information.</li>
            <li><strong>Credentials:</strong> You are responsible for maintaining the confidentiality of your account credentials.</li>
            <li><strong>Prohibited Use:</strong> You agree not to exploit our search index, bypass rate limits, or perform automated scraping of our aggregated catalogs.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-2">3. Limitation of Liability</h2>
          <ul className="list-disc pl-5 space-y-2 text-sm">
            <li><strong>No Warranty:</strong> Lelam is provided "as is" and "as available". We do not guarantee the availability, accuracy, or completeness of the crawled MSTC catalogs.</li>
            <li><strong>Bid Outcomes:</strong> Lelam is not responsible for any losses, missed bids, or disputes arising from participation in MSTC auctions. All disputes regarding auction bids or payments must be settled directly with MSTC India.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-2">4. Governing Law</h2>
          <p className="text-sm">
            These terms are governed by the laws of India, under the jurisdiction of courts where MSTC Limited or the administrative Ministry (Ministry of Steel) operates.
          </p>
        </section>
      </div>
    </div>
  );
}
