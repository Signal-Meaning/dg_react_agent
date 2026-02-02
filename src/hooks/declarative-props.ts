import { useEffect, useRef, MutableRefObject } from 'react';

/**
 * Hook to store a callback in a ref to avoid stale closures
 * @param callback - Callback function to store
 * @returns Ref containing the latest callback
 */
export function useCallbackRef<T extends (...args: unknown[]) => unknown>(
  callback: T | undefined
): MutableRefObject<T | undefined> {
  const callbackRef = useRef<T | undefined>(callback);
  
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);
  
  return callbackRef;
}

/**
 * Hook for boolean declarative props that trigger actions on change
 * @param currentValue - Current boolean prop value
 * @param onTrue - Callback when prop changes to true
 * @param onFalse - Optional callback when prop changes to false
 * @param onComplete - Optional callback to call after action completes
 * @param skipFirstRender - Whether to skip action on first render (default: true)
 * @param allowUndefinedToTrue - If true, allows action when prevValue is undefined and currentValue is true (default: false)
 */
export function useBooleanDeclarativeProp(
  currentValue: boolean | undefined,
  onTrue: () => void | Promise<void>,
  onFalse?: () => void | Promise<void>,
  onComplete?: () => void,
  skipFirstRender: boolean = true,
  allowUndefinedToTrue: boolean = false
): void {
  const prevValueRef = useRef<boolean | undefined>(undefined);
  const isFirstRenderRef = useRef<boolean>(true);
  
  useEffect(() => {
    const prevValue = prevValueRef.current;
    const isFirstRender = isFirstRenderRef.current;
    
    // Skip on first render (unless allowUndefinedToTrue is true and currentValue is true)
    if (skipFirstRender && isFirstRender) {
      isFirstRenderRef.current = false;
      // Allow action if allowUndefinedToTrue is true and currentValue is true
      // This handles the case where prop changes from undefined to true
      if (allowUndefinedToTrue && currentValue === true) {
        // Don't skip - allow the action to proceed below
      } else {
        // Skip first render - just update the ref
        prevValueRef.current = currentValue;
        return;
      }
    }
    
    // Only act when value changes
    if (currentValue === true && prevValue !== true) {
      const result = onTrue();
      if (result instanceof Promise) {
        result.then(() => {
          onComplete?.();
        }).catch((error) => {
          // Error handling should be done in onTrue callback
          console.error('[useBooleanDeclarativeProp] Error in onTrue:', error);
        });
      } else {
        // Synchronous completion - call onComplete immediately
        onComplete?.();
      }
    } else if (currentValue === false && prevValue !== false && onFalse) {
      const result = onFalse();
      if (result instanceof Promise) {
        result.then(() => {
          onComplete?.();
        }).catch((error) => {
          console.error('[useBooleanDeclarativeProp] Error in onFalse:', error);
        });
      } else {
        // Synchronous completion - call onComplete immediately
        onComplete?.();
      }
    }
    
    // Always update the ref at the end
    prevValueRef.current = currentValue;
  }, [currentValue, onTrue, onFalse, onComplete, skipFirstRender, allowUndefinedToTrue]);
}
