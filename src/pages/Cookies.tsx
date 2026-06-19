import { Cookie } from 'lucide-react';

export function Cookies() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center p-3 bg-primary/10 text-primary rounded-2xl mb-4">
          <Cookie className="w-8 h-8" />
        </div>
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Cookie Policy</h1>
        <p className="text-slate-500 mt-2 text-sm">Effective Date: June 18, 2026</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xs space-y-8 text-slate-700 leading-relaxed">
        <section className="space-y-3">
          <p>
            <strong>Lelam (Auction Central)</strong> uses cookies and similar technologies to deliver, measure, and improve your user experience.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-2">1. What are cookies?</h2>
          <p className="text-sm">
            Cookies are small text files stored on your browser or device by websites you visit. They allow websites to remember your preferences and actions over time.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-2">2. Why do we use cookies?</h2>
          <p>
            We use cookies for the following purposes:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-sm">
            <li><strong>Authentication & Session Management:</strong> We use essential session cookies (powered by Supabase) to keep you logged in as you navigate between pages.</li>
            <li><strong>Preferences & State:</strong> To remember your theme, layout choices, and active search filters.</li>
            <li><strong>Security:</strong> To protect your account from unauthorized hijacking and to prevent CSRF (Cross-Site Request Forgery) attacks.</li>
            <li><strong>Analytics:</strong> To understand how users interact with our search index and catalog downloads.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-2">3. How can you control cookies?</h2>
          <p>
            Most browsers allow you to block, delete, or manage cookies through their settings:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-sm">
            <li>Disabling essential cookies may prevent you from logging in or maintaining a watchlist on the platform.</li>
            <li>You can configure your browser to alert you when cookies are set or to refuse them entirely.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
