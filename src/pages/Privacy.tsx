import { Shield } from 'lucide-react';

export function Privacy() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center p-3 bg-primary/10 text-primary rounded-2xl mb-4">
          <Shield className="w-8 h-8" />
        </div>
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Privacy Policy</h1>
        <p className="text-slate-500 mt-2 text-sm">Effective Date: June 18, 2026</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xs space-y-8 text-slate-700 leading-relaxed">
        <section className="space-y-3">
          <p>
            Welcome to <strong>Lelam (Auction Central)</strong>. This Privacy Policy explains what information we collect, how we use and share it, and how you can manage your information on our platform.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-2">1. What information do we collect?</h2>
          <p>
            To provide our discovery and assistance services, we collect and process information about you. The types of information we collect depend on how you use our platform:
          </p>
          
          <div className="space-y-3 pl-4">
            <h3 className="font-bold text-slate-800">A. Information you provide</h3>
            <ul className="list-disc pl-5 space-y-1.5 text-sm">
              <li><strong>Account Information:</strong> When you register on Lelam, we collect your name, email address, and phone number.</li>
              <li><strong>Watchlist & Search Preferences:</strong> We store the auctions you add to your watchlist, search queries you enter, and categories you browse.</li>
              <li><strong>Document Vault uploads:</strong> Any documents (such as verification IDs or credentials) that you upload to your private Document Vault.</li>
            </ul>

            <h3 className="font-bold text-slate-800 mt-4">B. Information collected automatically</h3>
            <ul className="list-disc pl-5 space-y-1.5 text-sm">
              <li><strong>Usage & Log Data:</strong> We collect information about your activity on our platform via our audit log systems, including pages viewed, search queries, and handoffs/redirects to the MSTC portal.</li>
              <li><strong>Device & Browser Details:</strong> IP address, browser type, operating system, and page interaction events (e.g., clicks and search filter settings).</li>
            </ul>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-2">2. How do we use this information?</h2>
          <p>
            We use the information we collect to provide a secure, efficient, and personalized discovery experience:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-sm">
            <li><strong>Provide and Improve the Platform:</strong> To run search queries against the crawled MSTC catalog, match you with relevant auction listings, and run AI summaries.</li>
            <li><strong>Notifications & Alerts:</strong> To notify you about changes in active bids, price updates on your watchlist, or platform-wide announcements.</li>
            <li><strong>Handoff & Redirects:</strong> To facilitate seamless transfers to the official MSTC eCommerce portal for active bidding.</li>
            <li><strong>Security & Compliance:</strong> To track unauthorized access, verify user roles, and prevent malicious scraping or API abuse.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-2">3. How is this information shared?</h2>
          <p>
            We may share, disclose, or transfer certain categories of information, including data that may be considered personal information under applicable laws, to business partners, service providers, and third parties for purposes such as providing, improving, supporting, or monetizing our services. The specific categories of information shared and the purposes for such sharing may vary depending on our business operations and applicable legal requirements. Where required by law, we will provide users with appropriate notices, choices, and rights regarding such data practices.
          </p>
          <p>
            We also may be obliged by law to share your personal information under these conditions:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-sm">
            <li><strong>With Official Platforms (Handoffs):</strong> When you click "Open Official MSTC Listing," we pass along relevant identifiers (such as the MSTC Auction Number) to route you to the correct official page.</li>
            <li><strong>For Security and Legal Reasons:</strong> We may share information to comply with applicable laws, government regulations, or judicial requests (e.g., under the RTI Act, 2005 context or Ministry of Steel audits).</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-2">4. How can you manage your data?</h2>
          <ul className="list-disc pl-5 space-y-2 text-sm">
            <li><strong>Account Settings:</strong> You can edit your profile information at any time through the Profile Settings page.</li>
            <li><strong>Data Deletion:</strong> You can delete your watchlist items, remove documents from your vault, or request account termination.</li>
            <li><strong>Search History:</strong> When personalization is accepted, recent searches are associated with your account to improve recommendations across devices.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
