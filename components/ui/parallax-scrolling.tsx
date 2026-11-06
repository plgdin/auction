'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from '@studio-freight/lenis';
import { ArrowUpRight, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ParallaxComponentProps {
  title?: string;
  eyebrow?: string;
  subtitle?: string;
  className?: string;
  showContent?: boolean;
  bgImage?: string;
  midImage?: string;
}

export function ParallaxComponent({
  title = "lelam.co",
  eyebrow,
  subtitle = "Handpicked vintage and pre-loved archive pieces",
  className,
  showContent = true,
  bgImage = "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?q=80&w=2070&auto=format&fit=crop",
  midImage = "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?q=80&w=2070&auto=format&fit=crop",
}: ParallaxComponentProps = {}) {
  const parallaxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const triggerElement = parallaxRef.current?.querySelector('[data-parallax-layers]');

    let tl: gsap.core.Timeline | null = null;

    if (triggerElement) {
      tl = gsap.timeline({
        scrollTrigger: {
          trigger: triggerElement,
          start: "0% 0%",
          end: "100% 0%",
          scrub: 0,
        },
      });

      const layers = [
        { layer: "1", yPercent: 40 },
        { layer: "2", yPercent: 25 },
        { layer: "3", yPercent: 12 },
        { layer: "4", yPercent: 5 },
      ];

      layers.forEach((layerObj, idx) => {
        tl?.to(
          triggerElement.querySelectorAll(`[data-parallax-layer="${layerObj.layer}"]`),
          {
            yPercent: layerObj.yPercent,
            ease: "none",
          },
          idx === 0 ? undefined : "<",
        );
      });
    }

    const lenis = new Lenis();
    lenis.on('scroll', ScrollTrigger.update);
    const tickerUpdate = (time: number) => {
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(tickerUpdate);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(tickerUpdate);
      ScrollTrigger.getAll().forEach((st) => st.kill());
      if (triggerElement) {
        gsap.killTweensOf(triggerElement);
      }
      lenis.destroy();
    };
  }, []);

  return (
    <div className={cn("parallax", className)} ref={parallaxRef}>
      <section className="parallax__header">
        <div className="parallax__visuals">
          <div className="parallax__black-line-overflow"></div>
          <div data-parallax-layers className="parallax__layers">
            {/* Layer 1: Curated Vintage Fashion Thrift Racks Background */}
            <div
              data-parallax-layer="1"
              className="parallax__layer-wrapper"
              style={{ position: 'absolute', inset: 0 }}
            >
              <img
                src={bgImage}
                loading="eager"
                alt="Vintage fashion thrift collection"
                className="parallax__layer-img parallax__fashion-bg"
              />
              <div className="parallax__layer-tint" />
            </div>

            {/* Layer 2: Editorial Archival Garment Rail Detail */}
            <div
              data-parallax-layer="2"
              className="parallax__layer-wrapper"
              style={{ position: 'absolute', inset: 0 }}
            >
              <img
                src={midImage}
                loading="eager"
                alt="Curated thrift apparel rail"
                className="parallax__layer-img parallax__fashion-mid"
              />
            </div>

            {/* Layer 3: Typography & Identity */}
            <div data-parallax-layer="3" className="parallax__layer-title">
              {eyebrow && <span className="parallax__eyebrow">{eyebrow}</span>}
              <h1 className="parallax__title">{title}</h1>
              {subtitle && <p className="parallax__subtitle">{subtitle}</p>}
            </div>

            {/* Layer 4: Foreground Vignette & Archival Contrast Depth */}
            <div
              data-parallax-layer="4"
              className="parallax__layer-wrapper pointer-events-none"
              style={{ position: 'absolute', inset: 0 }}
            >
              <div className="parallax__fashion-overlay" />
            </div>
          </div>
          <div className="parallax__fade"></div>
        </div>
      </section>

      {showContent && (
        <section className="parallax__content">
          <div className="parallax__content-inner">
            <div className="parallax__content-icon" aria-hidden="true">
              <Sparkles size={26} />
            </div>
            <h3>Good finds. <em>Better stories.</em></h3>
            <p>
              Every garment in the lelam archive carries a history. Browse verified one-of-one
              pieces curated from premier independent vintage thrift stores.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 mt-3">
              <a href="#rack" className="button button-olive inline-flex items-center gap-2" onClick={(e) => { e.preventDefault(); document.getElementById("rack")?.scrollIntoView({ behavior: "smooth" }); }}>
                Inspect the Rack <ArrowUpRight size={17} />
              </a>
              <a href="#shop" className="button button-ghost inline-flex items-center gap-2" onClick={(e) => { e.preventDefault(); document.getElementById("shop")?.scrollIntoView({ behavior: "smooth" }); }}>
                Browse live auctions
              </a>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

export default ParallaxComponent;
