import { useState, useCallback, useSyncExternalStore } from "react";

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

// History store to track past/future stacks without causing ref-during-render issues
function createHistoryStore<T>() {
  let past: T[] = [];
  let future: T[] = [];
  const listeners: Set<() => void> = new Set();

  const notify = () => listeners.forEach((l) => l());

  return {
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getPastLength: () => past.length,
    getFutureLength: () => future.length,
    pushPast: (value: T, maxHistory: number) => {
      past = [...past, value].slice(-maxHistory);
      future = [];
      notify();
    },
    popPast: (): T | undefined => {
      if (past.length === 0) return undefined;
      const value = past[past.length - 1];
      past = past.slice(0, -1);
      notify();
      return value;
    },
    pushFuture: (value: T) => {
      future = [value, ...future];
      notify();
    },
    popFuture: (): T | undefined => {
      if (future.length === 0) return undefined;
      const value = future[0];
      future = future.slice(1);
      notify();
      return value;
    },
    appendPast: (value: T) => {
      past = [...past, value];
      notify();
    },
    clear: () => {
      past = [];
      future = [];
      notify();
    },
  };
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
  const [store] = useState(() => createHistoryStore<T>());

  const canUndo = useSyncExternalStore(store.subscribe, store.getPastLength) > 0;
  const canRedo = useSyncExternalStore(store.subscribe, store.getFutureLength) > 0;

  const setState = useCallback(
    (value: T | ((prev: T) => T), recordHistory = true) => {
      setStateInternal((prev) => {
        const newValue = typeof value === "function" ? (value as (prev: T) => T)(prev) : value;

        if (recordHistory) {
          store.pushPast(prev, maxHistory);
        }

        return newValue;
      });
    },
    [maxHistory, store]
  );

  const undo = useCallback(() => {
    const previous = store.popPast();
    if (previous === undefined) return;

    setStateInternal((current) => {
      store.pushFuture(current);
      return previous;
    });
  }, [store]);

  const redo = useCallback(() => {
    const next = store.popFuture();
    if (next === undefined) return;

    setStateInternal((current) => {
      store.appendPast(current);
      return next;
    });
  }, [store]);

  const clearHistory = useCallback(() => {
    store.clear();
  }, [store]);

  return {
    state,
    setState,
    undo,
    redo,
    canUndo,
    canRedo,
    clearHistory,
  };
}
