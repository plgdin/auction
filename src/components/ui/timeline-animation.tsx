import type { Variants, HTMLMotionProps } from 'framer-motion';
import { motion, useInView } from 'framer-motion';
import type React from 'react';

type SupportedElements = 'div' | 'p' | 'section' | 'article' | 'span' | 'header' | 'footer' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

type TimelineContentProps<T extends SupportedElements> = {
  children?: React.ReactNode;
  animationNum: number;
  className?: string;
  timelineRef: React.RefObject<HTMLElement | null>;
  as?: T;
  customVariants?: Variants;
  once?: boolean;
} & HTMLMotionProps<T>;

export const TimelineAnimation = <T extends SupportedElements = 'div'>({
  children,
  animationNum,
  timelineRef,
  className,
  as,
  customVariants,
  once = true,
  ...props
}: TimelineContentProps<T>) => {
  const defaultSequenceVariants = {
    visible: (i: number) => ({
      filter: 'blur(0px)',
      y: 0,
      opacity: 1,
      transition: {
        delay: i * 0.5,
        duration: 0.5,
      },
    }),
    hidden: {
      filter: 'blur(20px)',
      y: 0,
      opacity: 0,
    },
  };

  const sequenceVariants = customVariants || defaultSequenceVariants;

  const isInView = useInView(timelineRef, {
    once,
  });

  const MotionComponent = (motion[as as SupportedElements || 'div'] || motion.div) as any;

  return (
    <MotionComponent
      initial='hidden'
      animate={isInView ? 'visible' : 'hidden'}
      custom={animationNum}
      variants={sequenceVariants}
      className={className}
      {...props}
    >
      {children}
    </MotionComponent>
  );
};

export const TimelineContent = TimelineAnimation;
