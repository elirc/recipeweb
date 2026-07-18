import { useCallback, useEffect, useRef, useState } from 'react';

/** Copy text to the clipboard with a transient "copied" flag for UI feedback. */
export function useCopy(timeoutMs = 2000): [boolean, (text: string) => Promise<void>] {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        // Fallback for older browsers / non-secure contexts
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), timeoutMs);
    },
    [timeoutMs],
  );

  return [copied, copy];
}
