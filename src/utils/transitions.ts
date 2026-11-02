/**
 * Safe View Transitions helper with prefers-reduced-motion check
 */
export function safeViewTransition(updateFn: () => void | Promise<void>) {
  if (
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    'startViewTransition' in document &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    (document as any).startViewTransition(() => {
      return updateFn();
    });
  } else {
    updateFn();
  }
}
