import { useInView } from 'motion/react';
import { useRef } from 'react';

export function useStaggerReveal() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  return { ref, isInView };
}
