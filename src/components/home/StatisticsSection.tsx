import { useEffect, useState, useRef } from 'react';

interface AnimatedNumberProps {
  value: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
}

function AnimatedNumber({ value, prefix = '', suffix = '', duration = 2000 }: AnimatedNumberProps) {
  const [count, setCount] = useState(0);
  const elementRef = useRef<HTMLSpanElement>(null);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setHasStarted(true);
        }
      },
      { threshold: 0.1 }
    );

    if (elementRef.current) {
      observer.observe(elementRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!hasStarted) return;

    let startTimestamp: number | null = null;
    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      
      // Easing function: easeOutQuad
      const easedProgress = progress * (2 - progress);
      
      setCount(Math.floor(easedProgress * value));

      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };

    window.requestAnimationFrame(step);
  }, [hasStarted, value, duration]);

  // Format count with Indian locale styling
  const formattedCount = count.toLocaleString('en-IN');

  return (
    <span ref={elementRef} className="font-extrabold tabular-nums">
      {prefix}
      {formattedCount}
      {suffix}
    </span>
  );
}

export function StatisticsSection() {
  const stats: { label: string; value: number; prefix?: string; suffix: string }[] = [
    { label: 'Registered Buyers', value: 50000, suffix: '+' },
    { label: 'Active Listings', value: 1200, suffix: '+' },
    { label: 'Upcoming Auctions', value: 350, suffix: '+' },
  ];

  return (
    <section className="relative bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 py-24 overflow-hidden border-y border-slate-800">
      {/* Decorative Background Glows */}
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-72 h-72 bg-primary-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-72 h-72 bg-emerald-600/5 rounded-full blur-3xl pointer-events-none" />

      {/* Subtle Grid Overlay */}
      <div className="absolute inset-0 opacity-15">
        <svg className="absolute left-0 top-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100" fill="none" stroke="currentColor">
          <pattern id="stats-grid" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="slate-700" strokeWidth="0.25" />
          </pattern>
          <rect width="100" height="100" fill="url(#stats-grid)" />
        </svg>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {stats.map((stat, index) => (
            <div 
              key={index} 
              className="group relative bg-slate-900/50 backdrop-blur-md py-10 px-8 rounded-2xl border border-slate-800 hover:border-slate-700 hover:-translate-y-1 transition-all duration-300 flex flex-col items-center text-center shadow-lg hover:shadow-2xl"
            >
              <span className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight mb-3 drop-shadow-sm group-hover:text-primary-400 transition-colors duration-300">
                <AnimatedNumber 
                  value={stat.value} 
                  prefix={stat.prefix} 
                  suffix={stat.suffix} 
                />
              </span>

              <span className="text-slate-400 font-semibold uppercase tracking-wider text-xs sm:text-sm">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
