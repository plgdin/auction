import React, { useEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { COARSE } from "@/src/lib/motion";

interface GenieSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  originSelector?: string;
  textureKind?: "search" | "cart";
  skipOpenAnimation?: boolean;
  children: ReactNode;
}

/**
 * Evaluates a 2D Cubic Bézier curve at parameter t in [0, 1].
 * B(t) = (1-t)^3*P0 + 3(1-t)^2*t*P1 + 3(1-t)*t^2*P2 + t^3*P3
 */
function cubicBezierPoint(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  t: number,
): { x: number; y: number } {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;
  const t2 = t * t;
  const t3 = t2 * t;

  return {
    x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
    y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y,
  };
}

/**
 * Constructs a continuous smooth boundary path with curved rounded corners (24px radius)
 * that perfectly matches the modal card's rounded-3xl profile on all 4 corners.
 */
function buildGenieBoundaryPath(
  leftPoints: { x: number; y: number }[],
  rightPoints: { x: number; y: number }[],
  targetRadius = 24
): Path2D {
  const N = leftPoints.length;
  const path = new Path2D();
  if (N < 2) return path;

  const tl = leftPoints[0];
  const tr = rightPoints[0];
  const bl = leftPoints[N - 1];
  const br = rightPoints[N - 1];

  const maxRw = Math.min(tr.x - tl.x, br.x - bl.x) * 0.45;
  const maxRh = Math.min(bl.y - tl.y, br.y - tr.y) * 0.45;
  const r = Math.max(0, Math.min(targetRadius, maxRw, maxRh));

  if (r < 2) {
    path.moveTo(tl.x, tl.y);
    for (let i = 1; i < N; i++) path.lineTo(leftPoints[i].x, leftPoints[i].y);
    for (let i = N - 1; i >= 0; i--) path.lineTo(rightPoints[i].x, rightPoints[i].y);
    path.closePath();
    return path;
  }

  let kTr = 0;
  while (kTr < N && rightPoints[kTr].y < tr.y + r) kTr++;

  let kBr = N - 1;
  while (kBr >= 0 && rightPoints[kBr].y > br.y - r) kBr--;

  let kBl = N - 1;
  while (kBl >= 0 && leftPoints[kBl].y > bl.y - r) kBl--;

  let kTl = 0;
  while (kTl < N && leftPoints[kTl].y < tl.y + r) kTl++;

  // 1. Top edge starting after top-left rounded corner
  path.moveTo(tl.x + r, tl.y);
  path.lineTo(tr.x - r, tr.y);

  // 2. Top-right rounded corner
  const nextTr = kTr < N ? rightPoints[kTr] : br;
  path.arcTo(tr.x, tr.y, nextTr.x, nextTr.y, r);

  // 3. Right curved boundary contour
  for (let i = kTr; i <= kBr; i++) {
    path.lineTo(rightPoints[i].x, rightPoints[i].y);
  }

  // 4. Bottom-right rounded corner
  path.arcTo(br.x, br.y, br.x - r, br.y, r);

  // 5. Bottom edge towards bottom-left
  path.lineTo(bl.x + r, bl.y);

  // 6. Bottom-left rounded corner
  const nextBl = kBl >= 0 ? leftPoints[kBl] : tl;
  path.arcTo(bl.x, bl.y, nextBl.x, nextBl.y, r);

  // 7. Left curved boundary contour
  for (let i = kBl; i >= kTl; i--) {
    path.lineTo(leftPoints[i].x, leftPoints[i].y);
  }

  // 8. Top-left rounded corner
  path.arcTo(tl.x, tl.y, tl.x + r, tl.y, r);
  path.closePath();

  return path;
}

/**
 * Draws the high-fidelity parchment Search Modal Card texture onto an offscreen canvas.
 * Perfectly mirrors the layout, Gumela Arabic typography, warm colors, borders, and controls of SearchModalCard.
 */
function renderCardTexture(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  kind: "search" | "cart",
) {
  ctx.clearRect(0, 0, width, height);

  // Parchment Card Background
  ctx.fillStyle = "#FAF4EB";
  ctx.beginPath();
  ctx.roundRect(1, 1, width - 2, height - 2, 24);
  ctx.fill();

  // Subtle stitched border
  ctx.strokeStyle = "#D5C2A5";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(1, 1, width - 2, height - 2, 24);
  ctx.stroke();

  // Header: 'search on' in sans-serif + 'lelam' in bold Gumela Arabic
  ctx.textBaseline = "middle";

  const searchOnText = kind === "search" ? "search on " : "your ";
  ctx.font = "500 22px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#6D533E";
  const searchOnWidth = ctx.measureText(searchOnText).width;

  const lelamText = kind === "search" ? "lelam" : "cart";
  ctx.font = '800 26px "Gumela Arabic", serif';
  ctx.fillStyle = "#493022";
  const lelamWidth = ctx.measureText(lelamText).width;

  const totalHeaderW = searchOnWidth + lelamWidth;
  const headerStartX = (width - totalHeaderW) / 2;

  ctx.textAlign = "left";
  ctx.font = "500 22px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#6D533E";
  ctx.fillText(searchOnText, headerStartX, 38);

  ctx.font = '800 26px "Gumela Arabic", serif';
  ctx.fillStyle = "#493022";
  ctx.fillText(lelamText, headerStartX + searchOnWidth, 38);

  // Close 'X' button at top right
  const closeX = width - 28;
  const closeY = 32;
  ctx.strokeStyle = "#6D533E";
  ctx.lineWidth = 2.2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(closeX - 6, closeY - 6);
  ctx.lineTo(closeX + 6, closeY + 6);
  ctx.moveTo(closeX + 6, closeY - 6);
  ctx.lineTo(closeX - 6, closeY + 6);
  ctx.stroke();

  // Search input pill
  const inputMargin = 24;
  const inputY = 74;
  const inputH = 48;
  const inputW = width - inputMargin * 2;

  ctx.fillStyle = "#FFFDF9";
  ctx.strokeStyle = "#CBB693";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(inputMargin, inputY, inputW, inputH, 24);
  ctx.fill();
  ctx.stroke();

  // Magnifying glass icon inside search pill
  const iconCx = inputMargin + 22;
  const iconCy = inputY + 23;
  ctx.strokeStyle = "#8C745A";
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(iconCx, iconCy, 6.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(iconCx + 4.8, iconCy + 4.8);
  ctx.lineTo(iconCx + 9.5, iconCy + 9.5);
  ctx.stroke();

  // Placeholder text
  ctx.fillStyle = "#9C856C";
  ctx.font = "14px system-ui, -apple-system, sans-serif";
  ctx.fillText("Denim, a leather jacket, homeware…", inputMargin + 40, inputY + 25);

  // Section label: FRESH ON THE RAIL
  ctx.fillStyle = "#8C745A";
  ctx.font = "600 11px system-ui, -apple-system, sans-serif";
  ctx.fillText("FRESH ON THE RAIL", inputMargin + 4, 150);

  // 4 Sample listing rows
  const items = kind === "search" ? [
    { title: "Jacket", sub: "Good · Nila Vintage", price: "₹12,345", color: "#2B3747" },
    { title: "The worn-in denim jacket", sub: "Like new · Nila Vintage", price: "₹1,450", color: "#3B5C75" },
    { title: "Sunday morning knit", sub: "Good · Nila Vintage", price: "₹980", color: "#D3C2A9" },
    { title: "The quilted leather bag", sub: "Good · Nila Vintage", price: "₹1,250", color: "#2A1F18" },
  ] : [
    { title: "Selected piece", sub: "Condition · Size", price: "₹—", color: "#D3C2A9" },
    { title: "Your shortlist", sub: "One-of-one finds", price: "₹—", color: "#3B5C75" },
    { title: "Order summary", sub: "Subtotal · platform fee", price: "", color: "#2B3747" },
    { title: "Doorstep delivery", sub: "Across India", price: "", color: "#D3C2A9" },
  ];

  let itemY = 168;
  const rowH = 62;
  const rowGap = 8;
  items.forEach((item) => {
    ctx.fillStyle = "#FFFDF9";
    ctx.strokeStyle = "#E8DCCB";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(inputMargin, itemY, inputW, rowH, 16);
    ctx.fill();
    ctx.stroke();

    // Thumbnail preview
    ctx.fillStyle = item.color;
    ctx.beginPath();
    ctx.roundRect(inputMargin + 8, itemY + 7, 48, 48, 12);
    ctx.fill();
    ctx.strokeStyle = "rgba(213, 194, 165, 0.7)";
    ctx.stroke();

    // Item title
    ctx.fillStyle = "#332417";
    ctx.font = "600 14px system-ui, -apple-system, sans-serif";
    ctx.fillText(item.title, inputMargin + 66, itemY + 26);

    // Subtitle
    ctx.fillStyle = "#8C745A";
    ctx.font = "12px system-ui, -apple-system, sans-serif";
    ctx.fillText(item.sub, inputMargin + 66, itemY + 44);

    // Price
    ctx.fillStyle = "#493022";
    ctx.font = "bold 14px Georgia, serif";
    ctx.textAlign = "right";
    ctx.fillText(item.price, inputMargin + inputW - 14, itemY + 36);
    ctx.textAlign = "left";

    itemY += rowH + rowGap;
  });

  // Bottom "See all listings →" CTA button
  const btnY = height - 66;
  const btnH = 46;
  ctx.fillStyle = "#493022";
  ctx.beginPath();
  ctx.roundRect(inputMargin, btnY, inputW, btnH, 16);
  ctx.fill();

  ctx.fillStyle = "#FAF4EB";
  ctx.font = "600 14px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(kind === "search" ? "See all listings →" : "Review your cart →", width / 2, btnY + 27);
  ctx.textAlign = "left";
}

export function GenieSearchModal({
  isOpen,
  onClose,
  originSelector = ".lelam-search-toggle",
  textureKind = "search",
  skipOpenAnimation = false,
  children,
}: GenieSearchModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const [animState, setAnimState] = useState<"idle" | "opening" | "settled" | "closing">("idle");
  const animRef = useRef<number | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const activeElement = document.activeElement;
    returnFocusRef.current = activeElement instanceof HTMLElement ? activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const background = Array.from(
      document.querySelectorAll<HTMLElement>(
        ".site-shell > header, .site-shell > .site-content, .site-shell > footer",
      ),
    ).map((element) => ({
      element,
      inert: element.inert,
      ariaHidden: element.getAttribute("aria-hidden"),
    }));
    background.forEach(({ element }) => {
      element.inert = true;
      element.setAttribute("aria-hidden", "true");
    });

    return () => {
      document.body.style.overflow = previousOverflow;
      background.forEach(({ element, inert, ariaHidden }) => {
        element.inert = inert;
        if (ariaHidden === null) element.removeAttribute("aria-hidden");
        else element.setAttribute("aria-hidden", ariaHidden);
      });
      const previousTarget = returnFocusRef.current;
      const visible = (element: HTMLElement | null): element is HTMLElement =>
        Boolean(element?.isConnected && element.getClientRects().length);
      const origin = document.querySelector<HTMLElement>(originSelector);
      const fallback = document.querySelector<HTMLElement>(".lelam-account-btn");
      const target = visible(previousTarget) ? previousTarget : visible(origin) ? origin : fallback;
      target?.focus();
      returnFocusRef.current = null;
    };
  }, [isOpen, originSelector]);

  useEffect(() => {
    if (!isOpen || animState !== "settled") return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const initialTarget =
      dialog.querySelector<HTMLElement>("[autofocus]") ??
      dialog.querySelector<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
      );
    initialTarget?.focus();
  }, [isOpen, animState]);

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Measure button and modal geometry
  const getGeometry = () => {
    if (typeof window === "undefined") {
      return {
        targetX: 800,
        targetY: 36,
        targetW: 42,
        targetH: 42,
        modalX: 400,
        modalY: 360,
        modalW: 512,
        modalH: 538,
        modalTop: 96,
      };
    }

    const originEl = document.querySelector(originSelector);
    const originRect = originEl?.getBoundingClientRect();

    const targetX = originRect ? originRect.left + originRect.width / 2 : window.innerWidth - 180;
    const targetY = originRect ? originRect.top + originRect.height / 2 : 36;
    const targetW = originRect ? originRect.width : 42;
    const targetH = originRect ? originRect.height : 42;

    const modalW = Math.min(512, window.innerWidth - 32);
    const modalH = Math.min(538, window.innerHeight - 32);
    const modalTop = Math.max(16, (window.innerHeight - modalH) / 2);
    const modalX = window.innerWidth / 2;
    const modalY = modalTop + modalH / 2;

    return {
      targetX,
      targetY,
      targetW,
      targetH,
      modalX,
      modalY,
      modalW,
      modalH,
      modalTop,
    };
  };

  // Trigger Genie Opening Animation
  useEffect(() => {
    if (!isOpen) {
      setAnimState("idle");
      return;
    }

    if (prefersReducedMotion || COARSE || skipOpenAnimation) {
      setAnimState("settled");
      return;
    }

    setAnimState("opening");

    const geom = getGeometry();
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

    // Create / configure offscreen texture canvas
    if (!offscreenCanvasRef.current) {
      offscreenCanvasRef.current = document.createElement("canvas");
    }
    const offscreen = offscreenCanvasRef.current;
    offscreen.width = geom.modalW * dpr;
    offscreen.height = geom.modalH * dpr;
    const offCtx = offscreen.getContext("2d");
    if (offCtx) {
      offCtx.scale(dpr, dpr);
      renderCardTexture(offCtx, geom.modalW, geom.modalH, textureKind);
    }

    const duration = 460; // ms
    let startTime: number | null = null;
    const N = 60; // 60 slices for ultra-fluid liquid curvature

    // Setup macOS Quartz-style Cubic Bézier Spine
    // P0: Search button anchor
    // P1: Initial downward stream tangent out of button
    // P2: Upward entry tangent into modal top
    // P3: Modal center destination
    const p0 = { x: geom.targetX, y: geom.targetY };
    const p1 = { x: geom.targetX - 25, y: geom.targetY + 130 };
    const p2 = { x: geom.modalX + 35, y: geom.modalTop - 30 };
    const p3 = { x: geom.modalX, y: geom.modalY };

    const renderFrame = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const p = Math.min(1, elapsed / duration);

      const canvas = canvasRef.current;
      if (!canvas) {
        animRef.current = requestAnimationFrame(renderFrame);
        return;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        animRef.current = requestAnimationFrame(renderFrame);
        return;
      }

      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      // Calculate slice geometry and smooth boundary contour
      const leftPoints: { x: number; y: number }[] = [];
      const rightPoints: { x: number; y: number }[] = [];

      for (let i = 0; i < N; i++) {
        const v = i / (N - 1); // 0 at top, 1 at bottom

        // Wave propagation: bottom slices lead outward, top slices stream from target
        const delay = (1 - v) * 0.34;
        const localT = Math.max(0, Math.min(1, (p - delay) / (1 - 0.34)));

        // Smooth cubic hermite flow
        const ease = localT * localT * (3 - 2 * localT);

        // Elastic overshoot settling bounce as card expands into position
        let settle = 1;
        if (p > 0.8) {
          const settleP = (p - 0.8) / 0.2;
          settle = 1 + Math.sin(settleP * Math.PI) * 0.016 * (1 - v * 0.4);
        }

        // Spine position sampled along cubic Bézier trajectory
        const spine = cubicBezierPoint(p0, p1, p2, p3, ease);

        // Vertical slice positioning
        const destY = geom.modalTop + v * geom.modalH;
        const currY = geom.targetY + (destY - geom.targetY) * ease;
        const currX = spine.x;

        // Fluid trumpet / funnel curved width expansion
        const currW =
          (geom.targetW + (geom.modalW - geom.targetW) * Math.pow(ease, 1.7)) * settle;

        leftPoints.push({ x: currX - currW / 2, y: currY });
        rightPoints.push({ x: currX + currW / 2, y: currY });
      }

      // Construct continuous smooth boundary path with curved rounded corners (24px)
      const boundaryPath = buildGenieBoundaryPath(leftPoints, rightPoints, 24);

      // Realistic paper shadow under the fluid shape
      ctx.save();
      ctx.shadowColor = "rgba(40, 24, 14, 0.35)";
      ctx.shadowBlur = 28 * Math.min(1, p * 1.8);
      ctx.shadowOffsetY = 12 * Math.min(1, p * 1.8);
      ctx.fillStyle = "#FAF4EB";
      ctx.fill(boundaryPath);
      ctx.restore();

      // Clip canvas to continuous boundary path, ensuring anti-aliased smooth edges
      ctx.save();
      ctx.clip(boundaryPath);

      // Draw horizontal slices of offscreen card texture
      for (let i = 0; i < N; i++) {
        const sy = i * (offscreen.height / N);
        const sh = offscreen.height / N;

        const currX = (leftPoints[i].x + rightPoints[i].x) / 2;
        const currY = leftPoints[i].y;
        const currW = rightPoints[i].x - leftPoints[i].x;

        const dx = currX - currW / 2 - 2;
        const dy = currY - 0.5;
        const dw = currW + 4;
        const nextY = i < N - 1 ? leftPoints[i + 1].y : currY + geom.modalH / N;
        const dh = Math.max(geom.modalH / N, nextY - currY + 1.2);

        ctx.drawImage(offscreen, 0, sy, offscreen.width, sh, dx, dy, dw, dh);
      }
      ctx.restore();

      // Draw continuous vintage border along the fluid curved boundary
      ctx.strokeStyle = "#D5C2A5";
      ctx.lineWidth = 1.5;
      ctx.stroke(boundaryPath);

      if (p < 1) {
        animRef.current = requestAnimationFrame(renderFrame);
      } else {
        // Animation finished: swap smoothly to the real interactive React DOM modal
        setAnimState("settled");
      }
    };

    animRef.current = requestAnimationFrame(renderFrame);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isOpen, prefersReducedMotion, textureKind, skipOpenAnimation]);

  // Handle closing with Genie suction animation back into search button
  const handleClose = () => {
    if (animState === "closing") return;

    if (prefersReducedMotion || COARSE) {
      onClose();
      return;
    }

    setAnimState("closing");

    const geom = getGeometry();
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const offscreen = offscreenCanvasRef.current;
    if (!offscreen) {
      onClose();
      return;
    }

    const duration = 380; // ms
    let startTime: number | null = null;
    const N = 60;

    const p0 = { x: geom.targetX, y: geom.targetY };
    const p1 = { x: geom.targetX - 25, y: geom.targetY + 130 };
    const p2 = { x: geom.modalX + 35, y: geom.modalTop - 30 };
    const p3 = { x: geom.modalX, y: geom.modalY };

    const renderCloseFrame = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const q = Math.min(1, elapsed / duration); // 0 (open) to 1 (sucked in)

      const canvas = canvasRef.current;
      if (!canvas) {
        animRef.current = requestAnimationFrame(renderCloseFrame);
        return;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        animRef.current = requestAnimationFrame(renderCloseFrame);
        return;
      }

      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      const leftPoints: { x: number; y: number }[] = [];
      const rightPoints: { x: number; y: number }[] = [];

      // When closing: TOP slice leads the suction into the button, bottom follows
      for (let i = 0; i < N; i++) {
        const v = i / (N - 1);
        const delayClose = v * 0.34; // top (v=0) gets sucked first
        const localQ = Math.max(0, Math.min(1, (q - delayClose) / (1 - 0.34)));

        // Suction acceleration into button
        const easeClose = Math.pow(localQ, 2.6);
        const remaining = 1 - easeClose;

        const spine = cubicBezierPoint(p0, p1, p2, p3, remaining);

        const destY = geom.modalTop + v * geom.modalH;
        const currY = geom.targetY + (destY - geom.targetY) * remaining;
        const currX = spine.x;

        const currW = geom.targetW + (geom.modalW - geom.targetW) * Math.pow(remaining, 1.7);

        leftPoints.push({ x: currX - currW / 2, y: currY });
        rightPoints.push({ x: currX + currW / 2, y: currY });
      }

      // Smooth boundary path with curved rounded corners (24px) for closing suction
      const boundaryPath = buildGenieBoundaryPath(leftPoints, rightPoints, 24);

      // Shadow
      ctx.save();
      ctx.shadowColor = "rgba(40, 24, 14, 0.3)";
      ctx.shadowBlur = 24 * (1 - q);
      ctx.shadowOffsetY = 10 * (1 - q);
      ctx.fillStyle = "#FAF4EB";
      ctx.fill(boundaryPath);
      ctx.restore();

      // Clip to smooth boundary
      ctx.save();
      ctx.clip(boundaryPath);

      for (let i = 0; i < N; i++) {
        const sy = i * (offscreen.height / N);
        const sh = offscreen.height / N;

        const currX = (leftPoints[i].x + rightPoints[i].x) / 2;
        const currY = leftPoints[i].y;
        const currW = rightPoints[i].x - leftPoints[i].x;

        const dx = currX - currW / 2 - 2;
        const dy = currY - 0.5;
        const dw = currW + 4;
        const nextY = i < N - 1 ? leftPoints[i + 1].y : currY + geom.modalH / N;
        const dh = Math.max(geom.modalH / N, nextY - currY + 1.2);

        ctx.drawImage(offscreen, 0, sy, offscreen.width, sh, dx, dy, dw, dh);
      }
      ctx.restore();

      // Border
      ctx.strokeStyle = "#D5C2A5";
      ctx.lineWidth = 1.5;
      ctx.stroke(boundaryPath);

      if (q < 1) {
        animRef.current = requestAnimationFrame(renderCloseFrame);
      } else {
        setAnimState("idle");
        onClose();
      }
    };

    animRef.current = requestAnimationFrame(renderCloseFrame);
  };

  // Close on Escape key
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && animState === "settled") {
        handleClose();
        return;
      }
      if (e.key !== "Tab" || !isOpen || animState !== "settled") return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (!first || !last) {
        e.preventDefault();
        dialog.focus();
      } else if (e.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, animState]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Warm Scrim Backdrop with blur */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: animState === "closing" ? 0 : 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        onClick={handleClose}
        className="overlay-scrim fixed inset-0 bg-[#25170F]/60 backdrop-blur-md cursor-pointer"
      />

      {/* Fluid Canvas Layer for macOS Genie Morphing Deformation */}
      <canvas
        ref={canvasRef}
        style={{
          display: animState === "settled" ? "none" : "block",
        }}
        className="pointer-events-none fixed inset-0 z-20 h-full w-full"
      />

      {/* Real Interactive React Modal Card (Shown when settled) */}
      {animState === "settled" && (
          <div className="genie-modal-shell fixed inset-0 z-30 flex items-center justify-center p-4 pointer-events-auto">
          <div
            ref={dialogRef}
            className="w-full max-w-lg"
            role="dialog"
            aria-modal="true"
            aria-label={textureKind === "cart" ? "Your cart" : "Search listings"}
            tabIndex={-1}
          >
            {React.cloneElement(children as React.ReactElement<any>, {
              onClose: handleClose,
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default GenieSearchModal;
