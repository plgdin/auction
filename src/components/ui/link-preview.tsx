import * as HoverCardPrimitive from "@radix-ui/react-hover-card";
import { encode } from "qss";
import React from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
} from "framer-motion";
import { Link } from "react-router-dom";
import { Link as LinkIcon } from "lucide-react";
import { cn } from "../../lib/utils";

type LinkPreviewProps = {
  children: React.ReactNode;
  url: string;
  className?: string;
  width?: number;
  height?: number;
  quality?: number;
  layout?: string;
  isStatic?: boolean;
  imageSrc?: string;
};

export const LinkPreview = ({
  children,
  url,
  className,
  width = 200,
  height = 125,
  isStatic = false,
  imageSrc = "",
}: LinkPreviewProps) => {
  let src = "";
  const isExternalUrl = url.startsWith('http://') || url.startsWith('https://') || url.includes('.co') || url.includes('.com') || url.includes('.org') || url.includes('.in');
  
  if (!isStatic && isExternalUrl) {
    let validUrl = url;
    if (!validUrl.startsWith('http')) {
      validUrl = `https://${validUrl}`;
    }
    const params = encode({
      url: validUrl,
      screenshot: true,
      meta: false,
      embed: "screenshot.url",
      colorScheme: "dark",
      "viewport.isMobile": true,
      "viewport.deviceScaleFactor": 1,
      "viewport.width": width * 3,
      "viewport.height": height * 3,
    });
    src = `https://api.microlink.io/?${params}`;
  } else if (isStatic) {
    src = imageSrc;
  }

  const [isOpen, setOpen] = React.useState(false);
  const [isMounted, setIsMounted] = React.useState(false);
  // If we don't have a src, we should immediately show the fallback
  const [imageError, setImageError] = React.useState(!src);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const springConfig = { stiffness: 100, damping: 15 };
  const x = useMotionValue(0);
  const translateX = useSpring(x, springConfig);

  const handleMouseMove = (event: any) => {
    const targetRect = event.target.getBoundingClientRect();
    const eventOffsetX = event.clientX - targetRect.left;
    const offsetFromCenter = (eventOffsetX - targetRect.width / 2) / 2; // Reduce the effect to make it subtle
    x.set(offsetFromCenter);
  };

  const isExternal = url.startsWith('http://') || url.startsWith('https://');

  return (
    <>
      {isMounted ? (
        <div className="hidden">
          <img
            src={src}
            width={width}
            height={height}
            alt="hidden image"
          />
        </div>
      ) : null}

      <HoverCardPrimitive.Root
        openDelay={50}
        closeDelay={100}
        onOpenChange={(open: boolean) => {
          setOpen(open);
        }}
      >
        <HoverCardPrimitive.Trigger asChild>
          {isExternal ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              onMouseMove={handleMouseMove}
              className={cn("text-primary hover:underline cursor-pointer", className)}
            >
              {children}
            </a>
          ) : (
            <Link
              to={url}
              onMouseMove={handleMouseMove}
              className={cn("text-primary hover:underline cursor-pointer", className)}
            >
              {children}
            </Link>
          )}
        </HoverCardPrimitive.Trigger>

        <HoverCardPrimitive.Content
          className="[transform-origin:var(--radix-hover-card-content-transform-origin)] z-[100]"
          side="top"
          align="center"
          sideOffset={10}
        >
          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.6 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  scale: 1,
                  transition: {
                    type: "spring",
                    stiffness: 260,
                    damping: 20,
                  },
                }}
                exit={{ opacity: 0, y: 20, scale: 0.6 }}
                className="shadow-2xl rounded-xl overflow-hidden bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                style={{
                  x: translateX,
                }}
              >
                {isExternal ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-1 bg-white dark:bg-slate-800 hover:border-neutral-200 dark:hover:border-neutral-700"
                    style={{ fontSize: 0 }}
                  >
                    {imageError ? (
                      <div 
                        className="rounded-lg flex items-center justify-center bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-400"
                        style={{ width: `${width}px`, height: `${height}px` }}
                      >
                        <LinkIcon className="w-8 h-8 opacity-50" />
                      </div>
                    ) : (
                      <img
                        src={isStatic ? imageSrc : src}
                        width={width}
                        height={height}
                        className="rounded-lg object-cover"
                        alt="preview image"
                        style={{ width: `${width}px`, height: `${height}px` }}
                        onError={() => setImageError(true)}
                      />
                    )}
                  </a>
                ) : (
                  <Link
                    to={url}
                    className="block p-1 bg-white dark:bg-slate-800 hover:border-neutral-200 dark:hover:border-neutral-700"
                    style={{ fontSize: 0 }}
                  >
                    {imageError ? (
                      <div 
                        className="rounded-lg flex items-center justify-center bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-400"
                        style={{ width: `${width}px`, height: `${height}px` }}
                      >
                        <LinkIcon className="w-8 h-8 opacity-50" />
                      </div>
                    ) : (
                      <img
                        src={isStatic ? imageSrc : src}
                        width={width}
                        height={height}
                        className="rounded-lg object-cover"
                        alt="preview image"
                        style={{ width: `${width}px`, height: `${height}px` }}
                        onError={() => setImageError(true)}
                      />
                    )}
                  </Link>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </HoverCardPrimitive.Content>
      </HoverCardPrimitive.Root>
    </>
  );
};
