import { motion } from 'motion/react';
import { useRef } from 'react';
import { useInView } from 'motion/react';
import type { ReactNode } from 'react';

interface RevealProps {
  children: ReactNode;
  delay?: number;
  direction?: 'up' | 'left' | 'right' | 'fade';
}

const variants = {
  hidden: {
    up:    { opacity: 0, y: 20 },
    left:  { opacity: 0, x: -16 },
    right: { opacity: 0, x: 16 },
    fade:  { opacity: 0 },
  },
  visible: {
    up:    { opacity: 1, y: 0 },
    left:  { opacity: 1, x: 0 },
    right: { opacity: 1, x: 0 },
    fade:  { opacity: 1 },
  },
} as const;

export function Reveal({ children, delay = 0, direction = 'up' }: RevealProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-30px' });

  return (
    <motion.div
      ref={ref}
      initial={variants.hidden[direction]}
      animate={isInView ? variants.visible[direction] : variants.hidden[direction]}
      transition={{ delay, duration: 0.45, ease: [0.34, 1.1, 0.64, 1] }}
    >
      {children}
    </motion.div>
  );
}
