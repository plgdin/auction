import { ThreeDPhotoCarousel } from '../ui/3d-carousel';

export function HowItWorksSection() {
  return (
    <section className="py-14 sm:py-16 bg-slate-50/70 border-t border-slate-200/70 relative">
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-6 sm:mb-8">
          <h2 className="text-3xl font-extrabold text-slate-900 sm:text-4xl tracking-tight">
            Built-In Tools & Features
          </h2>
          <p className="mt-3 text-base sm:text-lg text-slate-600 leading-relaxed">
            Everything you need to analyze, bid, and win high-value eAuctions — all inside one platform.
          </p>
        </div>

        {/* 3D Feature Cards Carousel */}
        <div className="w-full overflow-visible">
          <ThreeDPhotoCarousel />
        </div>
      </div>
    </section>
  );
}
