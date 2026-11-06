import { ArrowUpRight, Tag } from 'lucide-react';
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
  title = 'sell your closet.',
  eyebrow = 'SELL ON LELAM',
  subtitle = 'Declutter the wardrobe. List the pieces you have stopped wearing and give them a second life on lelam.',
  className,
  showContent = true,
  bgImage = 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?q=80&w=2070&auto=format&fit=crop',
  midImage = 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?q=80&w=2070&auto=format&fit=crop',
}: ParallaxComponentProps = {}) {
  return (
    <div className={cn('parallax', className)}>
      <section className="parallax__header">
        <div className="parallax__visuals">
          <div className="parallax__black-line-overflow"></div>
          <div className="parallax__layers">
            <div className="parallax__layer-wrapper" style={{ position: 'absolute', inset: 0 }}>
              <img
                src={bgImage}
                loading="eager"
                alt="Vintage fashion thrift collection"
                className="parallax__layer-img parallax__fashion-bg"
              />
              <div className="parallax__layer-tint" />
            </div>

            <div className="parallax__layer-wrapper" style={{ position: 'absolute', inset: 0 }}>
              <img
                src={midImage}
                loading="eager"
                alt="Curated thrift apparel rail"
                className="parallax__layer-img parallax__fashion-mid"
              />
            </div>

            <div className="parallax__layer-title">
              {eyebrow && <span className="parallax__eyebrow">{eyebrow}</span>}
              <h1 className="parallax__title">{title}</h1>
              {subtitle && <p className="parallax__subtitle">{subtitle}</p>}
            </div>

            <div className="parallax__layer-wrapper pointer-events-none" style={{ position: 'absolute', inset: 0 }}>
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
              <Tag size={26} />
            </div>
            <h3>Good finds start in <em>your closet.</em></h3>
            <p>
              The clothes you are done with are exactly what someone else is hunting for.
              List them on lelam, set your price, and let the right person find them.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 mt-3">
              <a href="#/sell" className="button button-olive inline-flex items-center gap-2">
                Start selling <ArrowUpRight size={17} />
              </a>
              <a href="#/products" className="button button-ghost inline-flex items-center gap-2">
                Explore the marketplace
              </a>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

export default ParallaxComponent;
