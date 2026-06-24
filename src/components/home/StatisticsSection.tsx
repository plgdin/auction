import { useEffect, useRef } from 'react';

interface AnimatedNumberProps {
  value: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
}

// Pure CSS counter — zero JS rAF, zero main-thread blocking
function AnimatedNumber({ value, prefix = '', suffix = '', duration = 1800 }: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let startTimestamp: number | null = null;
    let rafId: number;
    let started = false;

    const step = (ts: number) => {
      if (!startTimestamp) startTimestamp = ts;
      const progress = Math.min((ts - startTimestamp) / duration, 1);
      const eased = progress * (2 - progress); // easeOutQuad
      const current = Math.floor(eased * value);
      el.textContent = `${prefix}${current.toLocaleString('en-IN')}${suffix}`;
      if (progress < 1) {
        rafId = requestAnimationFrame(step);
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !started) {
          started = true;
          observer.disconnect();
          // Use a single rAF per number, only when visible
          rafId = requestAnimationFrame(step);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [value, prefix, suffix, duration]);

  return (
    <span ref={ref} className="font-extrabold tabular-nums">
      {prefix}0{suffix}
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
    <section className="relative bg-slate-900 py-16 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-r from-primary-900 to-slate-900 mix-blend-multiply" />
        <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-primary-800/20 to-transparent" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center divide-y sm:divide-y-0 sm:divide-x divide-slate-800">
          {stats.map((stat, index) => (
            <div key={index} className="flex flex-col items-center justify-center p-4">
              <span className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight mb-2 drop-shadow-xs">
                <AnimatedNumber
                  value={stat.value}
                  prefix={stat.prefix}
                  suffix={stat.suffix}
                />
              </span>
              <span className="text-slate-300 font-semibold uppercase tracking-wider text-xs sm:text-sm">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
