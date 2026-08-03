import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useEffect, useRef, useState, useCallback, lazy, Suspense } from 'react';

const GLSLHills = lazy(() => import('../ui/glsl-hills').then(m => ({ default: m.GLSLHills })));

/**
 * HeroSection with scroll-driven logo animation.
 * 
 * The "lelam.co" text in the hero animates smoothly into the navbar logo
 * position as the user scrolls. Colors transition from white (hero) to
 * the dark brand color (navbar) during the animation.
 */
export function HeroSection() {
  const heroRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLImageElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  const handleScroll = useCallback(() => {
    if (!heroRef.current) return;
    const heroHeight = heroRef.current.offsetHeight;
    if (!heroHeight) {
      setScrollProgress(0);
      return;
    }
    const scrollY = window.scrollY;
    // Animation runs from 0% to 100% over the hero height
    const progress = Math.min(Math.max(scrollY / (heroHeight * 0.7), 0), 1);
    setScrollProgress(progress);
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    // Use requestAnimationFrame to ensure DOM layout is complete before first calculation
    const handle = requestAnimationFrame(() => {
      handleScroll();
    });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      cancelAnimationFrame(handle);
    };
  }, [handleScroll]);

  // Dispatch custom event so Header knows hero scroll state
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('hero-scroll-progress', { detail: scrollProgress }));
  }, [scrollProgress]);

  // Announce hero is mounted/unmounted
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('hero-mount', { detail: true }));
    return () => {
      window.dispatchEvent(new CustomEvent('hero-mount', { detail: false }));
    };
  }, []);

  // Calculate the logo's animated position
  // Start: centered in hero, large and white
  // End: fades out and translates up
  const logoScale = 1 - scrollProgress * 0.15; // 1 → 0.85
  const logoOpacity = Math.max(0, 1 - scrollProgress * 1.5); // fades out quickly

  // Smooth easing
  const eased = scrollProgress < 0.5
    ? 2 * scrollProgress * scrollProgress
    : 1 - Math.pow(-2 * scrollProgress + 2, 2) / 2;

  return (
    <div ref={heroRef} className="relative overflow-hidden -mt-[81px] min-h-[calc(100dvh+81px)] pt-12 pb-48 sm:pt-[193px] sm:pb-60 lg:pt-[225px] lg:pb-72 flex flex-col justify-center items-center text-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* GLSL Hills Background */}
      <div className="absolute inset-0 z-0 pointer-events-none" style={{ opacity: 0.75 * (1 - scrollProgress) }}>
        <Suspense fallback={null}>
          <GLSLHills width="100%" height="100%" />
        </Suspense>
      </div>

      {/* Simple dark overlay */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/20 to-slate-900/20 mix-blend-multiply" />
      </div>

      <div className="relative z-10 w-full px-4 sm:px-8 lg:px-12 flex flex-col items-center">
        <div className="max-w-4xl flex flex-col items-center">

          {/* "Introducing" text */}
          <p className="text-lg sm:text-2xl lg:text-3xl font-light tracking-[0.3em] sm:tracking-[0.55em] uppercase mb-4 text-slate-300/90 pl-[0.3em] sm:pl-[0.55em]" style={{
            opacity: 1 - scrollProgress * 1.5,
            transform: `translateY(${-scrollProgress * 40}px)`,
          }}>
            Introducing
          </p>

          {/* Animated lelam.co logo — fades out and translates up */}
          <div className="relative mb-6 max-w-[85vw] sm:max-w-none" style={{
            transform: `scale(${logoScale}) translateY(${-eased * 80}px)`,
            opacity: logoOpacity,
            transition: 'transform 0.05s linear, opacity 0.05s linear',
            transformOrigin: 'center center',
          }}>
            <img
              ref={logoRef}
              src="/png_lelam_1.webp"
              alt="Lelam Logo"
              width={700}
              height={140}
              className="w-auto max-h-[80px] sm:max-h-[120px] lg:max-h-[140px] object-contain select-none mx-auto"
              style={{
                filter: 'brightness(0) invert(1)',
              }}
              draggable={false}
            />
          </div>

          {/* Subtitle */}
          <p className="text-sm sm:text-base md:text-xl lg:text-2xl leading-relaxed mb-10 sm:mb-12 font-light tracking-[0.15em] sm:tracking-[0.35em] uppercase text-center text-slate-200 px-4" style={{
            opacity: 1 - scrollProgress * 1.3,
            transform: `translateY(${-scrollProgress * 30}px)`,
          }}>
            Where auctions are mainstream
          </p>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto px-4 sm:px-0" style={{
            opacity: 1 - scrollProgress * 1.5,
            transform: `translateY(${-scrollProgress * 20}px)`,
          }}>
            <Link
              to="/auctions"
              className="group inline-flex items-center justify-center px-8 sm:px-10 py-4 sm:py-5 text-base sm:text-lg font-semibold rounded-2xl text-white bg-primary hover:bg-primary-700 active:bg-primary-800 transition-all duration-300 shadow-xl shadow-primary/30 hover:shadow-primary/60 hover:-translate-y-0.5 cursor-pointer w-full sm:w-auto"
            >
              Explore Auctions
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </div>



    </div>
  );
}
