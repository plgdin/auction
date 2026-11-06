"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUpRight, Volume2, VolumeX, Wind } from "lucide-react";

type ArchivePillHeroProps = {
  onReplay?: () => void;
};

const REVEAL_MS = 2100;

function animate(
  node: HTMLElement | null,
  keyframes: Keyframe[] | PropertyIndexedKeyframes,
  options: KeyframeAnimationOptions,
  reverse: boolean,
) {
  if (!node) return null;
  return node.animate(keyframes, {
    duration: REVEAL_MS,
    fill: "forwards",
    easing: "linear",
    direction: reverse ? "reverse" : "normal",
    ...options,
  });
}

export default function ArchivePillHero({ onReplay }: ArchivePillHeroProps) {
  const heroRef = useRef<HTMLElement>(null);
  const wordRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const hairlineRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const footerRef = useRef<HTMLElement>(null);
  const ruleRef = useRef<HTMLSpanElement>(null);
  const iconsRef = useRef<HTMLDivElement>(null);
  const animations = useRef<Animation[]>([]);
  const [muted, setMuted] = useState(true);
  const [busy, setBusy] = useState(false);

  const clearAnimations = useCallback(() => {
    animations.current.forEach((animation) => animation.cancel());
    animations.current = [];
  }, []);

  const play = useCallback((reverse = false) => {
    clearAnimations();
    setBusy(true);
    const pill = pillRef.current;
    const hero = heroRef.current;
    const isPhone = window.matchMedia("(max-width: 720px)").matches;
    const finalWidth = isPhone ? `${Math.max(280, window.innerWidth - 40)}px` : "3.62em";
    const clipOpen = isPhone ? "inset(0 0 0 0)" : "inset(0 0 0 0)";
    const clipClosed = isPhone ? "inset(0 50% 0 50%)" : "inset(50% 0 50% 0)";
    const pillFrames: Keyframe[] = isPhone
      ? [
          { offset: 0, width: "1.5px", clipPath: clipClosed },
          { offset: 0.14, width: "1.5px", clipPath: clipOpen },
          { offset: 0.3, width: "10%", clipPath: clipOpen },
          { offset: 0.58, width: "55%", clipPath: clipOpen },
          { offset: 1, width: finalWidth, clipPath: clipOpen },
        ]
      : [
          { offset: 0, width: "0.012em", clipPath: clipClosed },
          { offset: 0.14, width: "0.012em", clipPath: clipOpen },
          { offset: 0.3, width: "0.16em", clipPath: clipOpen },
          { offset: 0.58, width: "1.81em", clipPath: clipOpen },
          { offset: 1, width: finalWidth, clipPath: clipOpen },
        ];

    const created = [
      animate(
        pill,
        pillFrames,
        { easing: "cubic-bezier(.5,0,.3,1)" },
        reverse,
      ),
      animate(
        wordRef.current,
        isPhone
          ? [{ offset: 0, gap: "0.03em" }, { offset: 0.58, gap: "0.07em" }, { offset: 1, gap: "0.1em" }]
          : [{ offset: 0, gap: "0.026em" }, { offset: 0.14, gap: "0.026em" }, { offset: 0.58, gap: "0.05em" }, { offset: 1, gap: "0.085em" }],
        {},
        reverse,
      ),
      animate(
        paperRef.current,
        [{ offset: 0.45, opacity: 0 }, { offset: 0.78, opacity: 1 }, { offset: 1, opacity: 1 }],
        {},
        reverse,
      ),
      animate(
        navRef.current,
        [{ offset: 0, transform: "translateY(-140%)", opacity: 0 }, { offset: 0.5, transform: "translateY(-140%)", opacity: 0 }, { offset: 0.86, transform: "translateY(0)", opacity: 1 }, { offset: 1, transform: "translateY(0)", opacity: 1 }],
        { easing: "cubic-bezier(.2,.8,.2,1)" },
        reverse,
      ),
      animate(
        footerRef.current,
        [{ offset: 0, transform: "translateY(160%)", opacity: 0 }, { offset: 0.52, transform: "translateY(160%)", opacity: 0 }, { offset: 0.9, transform: "translateY(0)", opacity: 1 }, { offset: 1, transform: "translateY(0)", opacity: 1 }],
        { easing: "cubic-bezier(.2,.8,.2,1)" },
        reverse,
      ),
      animate(
        ruleRef.current,
        [{ offset: 0.4, transform: "scaleX(0)" }, { offset: 0.95, transform: "scaleX(1)" }, { offset: 1, transform: "scaleX(1)" }],
        {},
        reverse,
      ),
      animate(
        iconsRef.current,
        [{ offset: 0, opacity: 0 }, { offset: 0.8, opacity: 0 }, { offset: 1, opacity: 1 }],
        {},
        reverse,
      ),
      animate(
        hairlineRef.current,
        [{ offset: 0, opacity: 1 }, { offset: 0.14, opacity: 1 }, { offset: 0.3, opacity: 0 }, { offset: 1, opacity: 0 }],
        {},
        reverse,
      ),
    ].filter((animation): animation is Animation => animation !== null);

    animations.current = created;
    Promise.all(created.map((animation) => animation.finished.catch(() => undefined))).then(() => {
      if (hero) hero.dataset.state = reverse ? "closed" : "open";
      if (!reverse) onReplay?.();
      setBusy(false);
    });
  }, [clearAnimations, onReplay]);

  const replay = useCallback(async () => {
    if (busy || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    play(true);
    await new Promise((resolve) => window.setTimeout(resolve, REVEAL_MS + 80));
    play(false);
  }, [busy, play]);

  useEffect(() => {
    let disposed = false;
    const showFinal = () => {
      const isPhone = window.matchMedia("(max-width: 720px)").matches;
      if (heroRef.current) heroRef.current.dataset.state = "open";
      if (pillRef.current) {
        pillRef.current.style.width = isPhone ? `${Math.max(280, window.innerWidth - 40)}px` : "3.62em";
        pillRef.current.style.clipPath = "inset(0)";
      }
      if (paperRef.current) paperRef.current.style.opacity = "1";
      if (navRef.current) { navRef.current.style.opacity = "1"; navRef.current.style.transform = "translateY(0)"; }
      if (footerRef.current) { footerRef.current.style.opacity = "1"; footerRef.current.style.transform = "translateY(0)"; }
      if (iconsRef.current) iconsRef.current.style.opacity = "1";
      if (hairlineRef.current) hairlineRef.current.style.opacity = "0";
      if (ruleRef.current) ruleRef.current.style.transform = "scaleX(1)";
      setBusy(false);
    };
    const start = () => {
      if (!disposed) {
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) showFinal();
        else play(false);
      }
    };
    if (document.fonts?.ready) document.fonts.ready.then(start);
    else start();
    const onResize = () => {
      clearAnimations();
      showFinal();
    };
    window.addEventListener("resize", onResize);
    return () => { disposed = true; clearAnimations(); window.removeEventListener("resize", onResize); };
  }, [clearAnimations, play]);

  return (
    <section ref={heroRef} className="archive-hero section-wrap" data-state="closed">
      <div ref={paperRef} className="archive-paper" aria-hidden="true">
        <svg viewBox="0 0 1440 800" preserveAspectRatio="none">
          <path d="M-30 650C180 470 350 600 480 420S790 170 960 300s240 50 510-170" />
          <path d="M-80 720c260-240 470-60 620-250S870 160 1060 250s230 70 450-140" />
          <path d="M-40 570c220-120 310 40 520-130s400-250 600-80 170 60 390-40" />
          <path d="M-90 785c220-170 400-120 580-270s370-190 530-70 230 80 460-100" />
          <path d="M170 820c160-210 290-190 430-320s310-140 450-50 250 80 420-60" />
          <path d="M520 800c110-155 260-210 390-170s210 110 360-30 210-180 260-190" />
          <path d="M-40 470c230-90 330 20 500-100s310-190 480-100 250 70 530-100" />
          <path d="M-30 390c250-100 350 40 520-80s320-150 480-60 260 60 500-80" />
          <path d="M220 0c140 100 210 170 360 90s260-170 410-50 220 150 500 20" />
          <path d="M470 0c130 110 220 130 350 70s260-100 380 20 230 120 320 90" />
          <path d="M780 0c100 100 190 130 310 100s230-40 350 40" />
          <path d="M-40 250c160-70 280-20 420-110s270-80 410 0 250 100 620-60" />
          <path d="M-20 170c190-90 290-20 440-100s260-50 390 10 240 60 570-80" />
          <path d="M20 90c180-80 290-30 410-80s250-30 370 30 230 30 500-50" />
          <path d="M40 740c190-130 340-120 480-210s300-90 440-10 270 80 500-90" />
        </svg>
      </div>

      <nav ref={navRef} className="archive-reveal-nav" aria-label="Archive navigation">
        <div className="archive-nav-links">
          <a href="#">lelam.co</a>
          <a href="#shop">Latest finds</a>
          <a href="#collections">Collections</a>
          <a href="#portal">The vault</a>
        </div>
        <span className="archive-nav-note">ONE OF EACH · ALWAYS</span>
      </nav>

      <div className="archive-hero-stage">
        <h1 className="sr-only">Good finds. Better stories.</h1>
        <div ref={wordRef} className="archive-wordmark" aria-label="lelam.co">
          <span aria-hidden="true">LE</span>
          <div ref={pillRef} className="archive-pill" aria-hidden="true">
            <img src="/images/hero.jpg" alt="" fetchPriority="high" />
            <span ref={hairlineRef} className="archive-hairline" />
            <div ref={iconsRef} className="archive-pill-icons">
              <Wind aria-hidden="true" />
              <button type="button" aria-label={muted ? "Show archive sound" : "Mute archive sound"} onClick={() => setMuted((value) => !value)}>
                {muted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
              </button>
            </div>
          </div>
          <span aria-hidden="true">LAM</span>
        </div>
        <div className="archive-hero-note">
          <span className="little-line" />
          <p>Old souls. New stories. A slower way to get dressed.</p>
          <a href="#shop" aria-label="Scroll to the latest finds"><ArrowDown aria-hidden="true" /></a>
        </div>
      </div>

      <footer ref={footerRef} className="archive-reveal-footer">
        <p className="archive-footer-copy"><span aria-hidden="true">E</span>mbark on a slower way around your wardrobe with our curated vintage archive. Discover character-rich pieces and hidden gems for your next favorite outfit.</p>
        <span ref={ruleRef} className="archive-footer-rule" aria-hidden="true" />
        <button type="button" className="archive-replay-button" onClick={() => void replay()} disabled={busy}>Replay the edit <ArrowUpRight aria-hidden="true" /></button>
      </footer>
    </section>
  );
}
