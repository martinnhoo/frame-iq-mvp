import { useState, useEffect } from "react";

/**
 * Returns a debounced version of the value.
 * Only updates after `delay` ms of no changes.
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

/**
 * Returns a debounced callback.
 * Useful for event handlers like onInput/onChange.
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  fn: T,
  delay: number = 300
): T {
  const timerRef = { current: 0 as any };

  return ((...args: any[]) => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fn(...args), delay) as any;
  }) as T;
}
