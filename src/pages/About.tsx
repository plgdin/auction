import { Target, Eye } from 'lucide-react';

export function About() {

  return (
    <div className="bg-slate-50/50 min-h-screen text-slate-800 font-sans">
      {/* Intro Animation Header Container */}
      <div className="max-w-5xl mx-auto px-6 pt-10 sm:pt-14 mb-12 flex justify-center text-center">
        <h1 className="text-7xl sm:text-8xl md:text-9xl tracking-tight text-slate-900 flex flex-wrap md:flex-nowrap items-baseline justify-center gap-x-4 gap-y-4 select-none w-full">
          {/* Word "We" */}
          <span className="relative inline-block whitespace-nowrap">
            <span className="inline-block overflow-hidden">
              <span
                className="inline-block animate-slide-up-word font-archivo text-slate-900 leading-none italic pr-4 py-1"
                style={{ animationDelay: '100ms' }}
              >
                We
              </span>
            </span>
          </span>

          {/* Word "are," */}
          <span className="relative inline-block whitespace-nowrap">
            <span className="inline-block overflow-hidden">
              <span
                className="inline-block animate-slide-up-word font-archivo text-slate-900 leading-none italic pr-4 py-1"
                style={{ animationDelay: '400ms' }}
              >
                are,
              </span>
            </span>
          </span>

          {/* Logo "lelam.co" */}
          <span className="relative inline-block whitespace-nowrap">
            <span className="inline-block overflow-hidden">
              <span
                className="inline-block animate-slide-up-word leading-none"
                style={{ animationDelay: '700ms' }}
              >
                <img
                  src="/png_lelam_1.webp"
                  alt="lelam.co"
                  className="h-14 sm:h-20 md:h-[108px] w-auto object-contain inline-block align-baseline"
                  style={{ transform: 'translateY(3%)' }}
                />
              </span>
            </span>
          </span>
        </h1>
      </div>

      <div className="max-w-5xl mx-auto px-6 pb-20 sm:pb-28">

        {/* Grid layout for balanced columns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start">

          {/* Left Column - Quote & Vision & Mission */}
          <div className="lg:col-span-1 space-y-6 text-left">
            <div className="space-y-4">
              <h2 className="text-2xl sm:text-3xl font-light text-slate-700 leading-snug tracking-normal text-left pl-7" style={{ textIndent: '-0.45em' }}>
                &ldquo;We didn&apos;t come from finance. We didn&apos;t come from government. We came from a small office in Trivandrum with one simple question&rdquo;
              </h2>

              <div
                className="border-l-4 border-primary pl-6 py-2 my-4 text-left animate-slide-in-right"
                style={{ animationDelay: '1400ms' }}
              >
                <p className="text-xl sm:text-2xl font-medium text-slate-900 leading-relaxed tracking-normal">
                  Why do thousands of government auctions worth crores of rupees take place every year, yet most businesses and entrepreneurs never know they exist?
                </p>
              </div>
            </div>

            {/* Vision & Mission sections (on the left, no card styling) */}
            <div className="pt-6 border-t border-slate-200 space-y-6">

              {/* Vision Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Eye className="w-5 h-5 text-slate-400" />
                  <h3 className="text-xl font-bold text-slate-900">Vision</h3>
                </div>
                <div className="space-y-3 text-slate-600 font-medium text-base sm:text-lg leading-relaxed text-justify tracking-normal">
                  <p>
                    To build a future where every MSTC eAuction, Customs auction, and government auction in India is as easy to discover, compare, and participate in as booking a flight. We envision a transparent marketplace where valuable public assets are accessible to every buyer.
                  </p>
                  <p>
                    By breaking down information barriers, we aim to build India's most trusted gateway for public tenders, scrap sales, and government surplus catalog listings, helping first-time bidders and large enterprises find new opportunities nationwide.
                  </p>
                </div>
              </div>

              {/* Mission Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Target className="w-5 h-5 text-slate-400" />
                  <h3 className="text-xl font-bold text-slate-900">Mission</h3>
                </div>
                <div className="space-y-3 text-slate-600 font-medium text-base sm:text-lg leading-relaxed text-justify tracking-normal">
                  <p>
                    To build India's most comprehensive government auction discovery and auction intelligence platform, empowering buyers to search MSTC eAuctions, Customs auctions, and other public auctions with robust analytical tools.
                  </p>
                  <p>
                    By offering historical pricing, transportation cost calculation, ROI estimation, and auction comparison metrics, we help businesses make data-driven decisions and modernize the public procurement ecosystem.
                  </p>
                </div>
              </div>

            </div>
          </div>

          {/* Right Column - Core Narrative with Long-Tail Keywords */}
          <div className="lg:col-span-1 space-y-4 text-slate-600 font-medium text-base sm:text-lg leading-relaxed text-justify tracking-normal lg:border-l lg:border-slate-200 lg:pl-10">
            <p>
              Across India, valuable commercial assets and industrial goods are sold daily through official channels like MSTC eAuctions, Indian Customs auctions, railway scrap sales, and public sector surplus auctions. These catalog listings include industrial scrap metal, heavy machinery, commercial vehicles, used electronics, and warehouse stock. Yet, this high-value inventory remains scattered across antiquated government websites and obscure PDF catalogs, making it hard for prospective bidders to track upcoming events.
            </p>

            <div className="my-2 p-6 bg-white rounded-2xl border border-slate-200/80 shadow-xs text-left">
              <p className="text-xl font-bold text-slate-900 tracking-normal">
                Experienced bidders know where to look. Most others don&apos;t.
              </p>
              <p className="text-primary font-bold mt-1 tracking-normal">
                That&apos;s why we built lelam.co
              </p>
            </div>

            <p>
              <strong className="text-slate-900 font-bold">lelam.co</strong> serves as a independant government auction intelligence platform that simplifies MSTC scrap auction tracking and Customs lot discovery. Instead of manually logging into multiple portals, scrap buyers, recyclers, and enterprises can query aggregated auction listings from a centralized search engine, set real-time bidding alerts, and analyze historical tender data to predict winning margins.
            </p>

            <p>
              By offering tools like a transport cost calculator, tax estimations, and historical price trackers for railway scrap, we empower bidders to calculate accurate ROI before participating in live bidding. We aim to democratize access to the public procurement market by removing the information asymmetry that has historically favored veteran bidders.
            </p>

            <p>
              We believe that open access to historical pricing databases and structured catalogs drives fair competition. By centralizing information on MSTC eAuctions, we help build a transparent ecosystem where every buyer has an equal shot at valuable public assets.
            </p>
          </div>
        </div>

      </div>

      <style>{`
        @keyframes slide-up-word {
          0% {
            transform: translateY(110%);
            opacity: 0;
          }
          100% {
            transform: translateY(0);
            opacity: 1;
          }
        }
        @keyframes draw-stripe {
          0% {
            transform: scaleX(0);
          }
          100% {
            transform: scaleX(1);
          }
        }
        @keyframes slide-in-right {
          0% {
            transform: translateX(100px);
            opacity: 0;
          }
          100% {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .font-archivo {
          font-family: 'Archivo', sans-serif;
          font-weight: 400;
        }
        .animate-slide-up-word {
          animation: slide-up-word 0.9s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          opacity: 0;
          will-change: transform, opacity;
        }
        .animate-draw-stripe {
          animation: draw-stripe 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          transform-origin: left;
          transform: scaleX(0);
          will-change: transform;
        }
        .animate-slide-in-right {
          animation: slide-in-right 1s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          opacity: 0;
          will-change: transform, opacity;
        }
      `}</style>
    </div>
  );
}
