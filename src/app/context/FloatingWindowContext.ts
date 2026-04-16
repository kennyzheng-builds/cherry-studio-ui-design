import { createContext, useContext } from 'react';

// ===========================
// FloatingWindowContext
// ===========================
// Signals whether the current React subtree is rendered inside a detached
// (popout) floating window. Pages can use this to hide navigation UI that
// shouldn't be reachable from a popout — e.g. "new topic", "history",
// "open another chat" — since a popout is a single-purpose window.

export const FloatingWindowContext = createContext<boolean>(false);

export function useIsFloatingWindow(): boolean {
  return useContext(FloatingWindowContext);
}
