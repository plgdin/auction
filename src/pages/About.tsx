import { Search, Calculator, FileText, FolderClosed, CheckCircle } from 'lucide-react';


export function About() {
  return (
    <div className="bg-slate-50 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-100">
      {/* Hero Section */}
      <div className="relative bg-slate-900 text-white overflow-hidden py-28 border-b border-slate-800">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-950 via-slate-900 to-slate-950 opacity-90 z-0"></div>
        
        {/* Subtle grid pattern overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-35 z-0"></div>

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center max-w-4xl">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-full mb-6 uppercase tracking-wider animate-pulse">
            B2B Auction Companion
          </span>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight mb-6 bg-gradient-to-r from-white via-slate-100 to-blue-200 bg-clip-text text-transparent leading-none">
            The Intelligent Companion for MSTC eAuctions
          </h1>
          <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed font-light">
            We don't replace the official auction platform. We make it smarter. Lelam helps buyers, scrap traders, and industrial recyclers navigate, estimate, and win listings.
          </p>
        </div>
      </div>

      {/* Main Philosophy Section */}
      <div className="py-20 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-855">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-6">
              <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
                What is Lelam?
              </h2>
              <p className="text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
                Navigating official government and industrial portals like MSTC can be overwhelming. Buyers are forced to sift through unstructured catalogs, download bulky PDF tender terms, and perform complex math to find out what they will actually pay.
              </p>
              <p className="text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
                <strong>Lelam</strong> was built to solve these exact friction points. It is a dedicated analytics and bidding workflow platform that acts as an intelligent layer over raw catalog listings.
              </p>
              <div className="pt-4 flex flex-col sm:flex-row gap-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-emerald-500 shrink-0 mt-1" />
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white">Smart Calculations</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Includes GST, TCS, EMD, and logistics.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-emerald-500 shrink-0 mt-1" />
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white">Workflow Efficiency</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Export client quotes instantly to PDFs.</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="relative p-8 rounded-3xl bg-slate-900 text-white shadow-xl overflow-hidden border border-slate-800">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl"></div>
              <h3 className="text-2xl font-bold mb-6 text-blue-400">The Lelam Advantage</h3>
              
              <div className="space-y-6 relative z-10">
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-blue-900/50 border border-blue-500/30 flex items-center justify-center font-bold text-blue-300 shrink-0">1</div>
                  <div>
                    <h4 className="font-semibold text-white">Official MSTC eAuctions</h4>
                    <p className="text-sm text-slate-400">Acts as the official secure system of record for final bids, registrations, and official tenders.</p>
                  </div>
                </div>
                
                <div className="border-l-2 border-dashed border-slate-700 h-6 ml-4"></div>
                
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-emerald-900/50 border border-emerald-500/30 flex items-center justify-center font-bold text-emerald-300 shrink-0">2</div>
                  <div>
                    <h4 className="font-semibold text-emerald-400">Lelam Analytics (Companion)</h4>
                    <p className="text-sm text-slate-400">Automatically parses PDF terms, updates listings, tracks market values, and estimates total landed costs.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Core Pillars / Toolsets */}
      <div className="py-24 bg-slate-50 dark:bg-slate-955">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white sm:text-4xl">
              Powerful Features Designed for Buyers
            </h2>
            <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
              Eliminate guesswork. Save hours of parsing PDF catalogs and calculating scrap taxes manually.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Pillar 1 */}
            <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-300 group">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 dark:bg-blue-500/5 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-6 group-hover:scale-110 transition-transform">
                <Search className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">Catalog Intelligence</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                No more confusing interfaces. Browse daily scrap catalogs, industrial items, and vehicle lots with autocomplete searches, status filters, and image indicators.
              </p>
            </div>

            {/* Pillar 2 */}
            <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-300 group">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 dark:bg-blue-500/5 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-6 group-hover:scale-110 transition-transform">
                <Calculator className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">Landed Cost Calculator</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                Tame the complex taxes. Calculate exact values with GST (18%), TCS (1%), state taxes, pre-bid deposits, and transport allowances so you see the true final price before bidding.
              </p>
            </div>

            {/* Pillar 3 */}
            <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-300 group">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 dark:bg-blue-500/5 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-6 group-hover:scale-110 transition-transform">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">Bidding Quote Builder</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                Compile professional quotations in seconds. Pick multiple lots from active auctions, adjust margins, and export a clean PDF document for vendor or manager signature.
              </p>
            </div>

            {/* Pillar 4 */}
            <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-300 group">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 dark:bg-blue-500/5 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-6 group-hover:scale-110 transition-transform">
                <FolderClosed className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">Document Compliance</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                Keep registration details, pre-bid EMDs, and terms sheets organized by auction number. Secure document vault built specifically for scrap trader compliance.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Simple Infographic Steps */}
      <div className="py-20 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-850">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white">How It Works</h2>
            <p className="mt-3 text-slate-500 dark:text-slate-400">Streamlining your auction bidding cycle in four simple steps</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
            <div className="text-center flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-white font-extrabold text-xl mb-4 shadow-md">
                1
              </div>
              <h4 className="font-bold text-slate-900 dark:text-white mb-2">Discover</h4>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs">Filter through active catalogues by material type and seller state.</p>
            </div>
            
            <div className="text-center flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-white font-extrabold text-xl mb-4 shadow-md">
                2
              </div>
              <h4 className="font-bold text-slate-900 dark:text-white mb-2">Analyze</h4>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs">Run calculations for GST, TCS, and EMD to understand landed cost.</p>
            </div>
            
            <div className="text-center flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-white font-extrabold text-xl mb-4 shadow-md">
                3
              </div>
              <h4 className="font-bold text-slate-900 dark:text-white mb-2">Compile</h4>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs">Build a customized quotation matching your target profit margins.</p>
            </div>
            
            <div className="text-center flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-blue-600 border border-blue-500 flex items-center justify-center text-white font-extrabold text-xl mb-4 shadow-md">
                4
              </div>
              <h4 className="font-bold text-blue-600 dark:text-blue-400 mb-2">Bid Smart</h4>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs">Participate on official portals equipped with complete price clarity.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
