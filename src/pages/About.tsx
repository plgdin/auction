import { Target, Eye } from 'lucide-react';

export function About() {
  return (
    <div className="bg-slate-50 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-100">
      {/* Hero Section */}
      <div className="relative bg-slate-900 text-white overflow-hidden py-28 border-b border-slate-800">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-950 via-slate-900 to-slate-950 opacity-90 z-0"></div>
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-35 z-0"></div>

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center max-w-4xl">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-full mb-6 uppercase tracking-wider animate-pulse">
            Our Story
          </span>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-8 bg-gradient-to-r from-white via-slate-100 to-blue-200 bg-clip-text text-transparent leading-snug">
            We didn't come from finance. We didn't come from government. We came from a small office in Trivandrum with one simple question:
          </h1>
          <p className="text-xl sm:text-2xl text-blue-300 max-w-3xl mx-auto leading-relaxed font-semibold">
            Why do thousands of government auctions worth crores of rupees take place every year, yet most businesses and entrepreneurs never know they exist?
          </p>
          <p className="mt-8 text-lg sm:text-xl text-slate-400 italic">
            "We were young, we were restless and honestly we were a little annoyed."
          </p>
        </div>
      </div>

      {/* Main Philosophy Section */}
      <div className="py-20 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-855">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          <div className="prose prose-lg dark:prose-invert prose-blue mx-auto">
            <p className="text-lg text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
              Across India, valuable assets are sold every day through MSTC eAuctions, Customs auctions, public sector auctions, and other government eAuction platforms. These include scrap metal, machinery, vehicles, electronics, minerals, industrial equipment, confiscated goods, warehouse stock, and surplus government assets. Yet this information is often scattered across multiple websites, hidden behind complex portals, and presented in ways that make it difficult for new buyers to discover and understand.
            </p>
            
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-200 my-10 text-center border-y border-slate-200 dark:border-slate-800 py-8">
              Experienced bidders know where to look. Most others don't.<br/>
              <span className="text-blue-600 dark:text-blue-400 mt-2 block">That's why we built Lelam.</span>
            </p>

            <p className="text-lg text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
              <strong>Lelam</strong> is an auction intelligence platform that makes MSTC eAuctions, Indian Customs auctions, and other government auction opportunities easier to discover, compare, and analyze. Instead of manually searching multiple portals, buyers can access auction listings from a single platform, compare opportunities, track historical trends, estimate transportation and procurement costs, calculate return on investment (ROI), and make informed bidding decisions with confidence.
            </p>

            <p className="text-lg text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
              We are not another auction platform—we are the layer that makes government auctions accessible. Our mission is to remove complexity from the buying process so that businesses of every size, first-time bidders, traders, recyclers, manufacturers, exporters, and entrepreneurs all have equal access to opportunities that were once difficult to find.
            </p>

            <p className="text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
              We believe that transparency creates opportunity. When auction information becomes easy to access, markets become more competitive, businesses make better decisions, and government assets reach a wider pool of qualified buyers.
            </p>
          </div>
        </div>
      </div>

      {/* Vision & Mission */}
      <div className="py-24 bg-slate-50 dark:bg-slate-955">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            
            {/* Vision */}
            <div className="bg-white dark:bg-slate-900 p-10 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:-translate-y-1 transition-transform">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
              <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-8">
                <Eye className="w-7 h-7" />
              </div>
              <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-6">Vision</h3>
              <p className="text-slate-600 dark:text-slate-400 text-lg leading-relaxed relative z-10">
                To build a future where every MSTC eAuction, Customs auction, and government auction in India is as easy to discover, understand, compare, and participate in as booking a flight—creating a transparent marketplace where opportunity is accessible to everyone.
              </p>
            </div>

            {/* Mission */}
            <div className="bg-white dark:bg-slate-900 p-10 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:-translate-y-1 transition-transform">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-8">
                <Target className="w-7 h-7" />
              </div>
              <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-6">Mission</h3>
              <p className="text-slate-600 dark:text-slate-400 text-lg leading-relaxed relative z-10 mb-6">
                To build India's most comprehensive government auction discovery and auction intelligence platform, empowering buyers to search MSTC eAuctions, Customs auctions, and other public auctions through powerful search, analytics, market insights, historical pricing, ROI estimation, and auction comparison tools.
              </p>
              <p className="text-slate-600 dark:text-slate-400 text-lg leading-relaxed relative z-10">
                By making government auctions easier to discover and understand, Lelam aims to modernize India's public auction ecosystem, increase participation, improve transparency, and help businesses make smarter, data-driven procurement decisions.
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
