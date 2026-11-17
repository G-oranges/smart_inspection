import { createContext, useContext } from 'react';

import type { AppContextValue } from '../types/app';

export const AppContext = createContext<AppContextValue | null>(null);

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('AppContext not found');
  }

  return ctx;
}
