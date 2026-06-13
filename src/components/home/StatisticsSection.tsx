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
    <section className="bg-primary py-16 relative overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center divide-y sm:divide-y-0 sm:divide-x divide-white/20">
          {stats.map((stat, index) => (
            <div key={index} className="flex flex-col items-center justify-center p-4">
              <span className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight mb-2 drop-shadow-sm">
                <AnimatedNumber 
                  value={stat.value} 
                  prefix={stat.prefix} 
                  suffix={stat.suffix} 
                />
              </span>
              <span className="text-white/80 font-semibold uppercase tracking-wider text-xs sm:text-sm">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
