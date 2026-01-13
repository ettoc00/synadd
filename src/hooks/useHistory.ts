import { useState, useCallback, useRef } from "react";

interface UseHistoryOptions {
  maxHistory?: number;
}

interface UseHistoryReturn<T> {
  state: T;
  setState: (value: T | ((prev: T) => T), recordHistory?: boolean) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  clearHistory: () => void;
}

/**
 * A hook that wraps useState with undo/redo history.
 * By default, every setState call is recorded. Pass `false` as second arg to skip recording.
 */
export function useHistory<T>(
  initialState: T | (() => T),
  options: UseHistoryOptions = {}
): UseHistoryReturn<T> {
  const { maxHistory = 50 } = options;

  const [state, setStateInternal] = useState(initialState);

  // Use refs to avoid recreating callbacks
  const pastRef = useRef<T[]>([]);
  const futureRef = useRef<T[]>([]);

  const setState = useCallback(
    (value: T | ((prev: T) => T), recordHistory = true) => {
      setStateInternal((prev) => {
        const newValue = typeof value === "function" ? (value as (prev: T) => T)(prev) : value;

        if (recordHistory) {
          // Push current state to past, clear future
          pastRef.current = [...pastRef.current, prev].slice(-maxHistory);
          futureRef.current = [];
        }

        return newValue;
      });
    },
    [maxHistory]
  );

  const undo = useCallback(() => {
    setStateInternal((current) => {
      if (pastRef.current.length === 0) return current;

      const previous = pastRef.current[pastRef.current.length - 1];
      pastRef.current = pastRef.current.slice(0, -1);
      futureRef.current = [current, ...futureRef.current];

      return previous;
    });
  }, []);

  const redo = useCallback(() => {
    setStateInternal((current) => {
      if (futureRef.current.length === 0) return current;

      const next = futureRef.current[0];
      futureRef.current = futureRef.current.slice(1);
      pastRef.current = [...pastRef.current, current];

      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    pastRef.current = [];
    futureRef.current = [];
  }, []);

  return {
    state,
    setState,
    undo,
    redo,
    canUndo: pastRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
    clearHistory,
  };
}
