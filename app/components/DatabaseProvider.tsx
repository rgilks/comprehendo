'use client';

import { createContext, useContext, ReactNode } from 'react';

interface DatabaseContextType {
  getDb: (d1Database?: unknown) => unknown;
}

const DatabaseContext = createContext<DatabaseContextType | null>(null);

export const DatabaseProvider = ({ children }: { children: ReactNode }) => {
  const getDb = async (d1Database?: unknown) => {
    const { getDb: getDbFunction } = await import('app/lib/db/adapter');
    return getDbFunction(d1Database);
  };

  return <DatabaseContext.Provider value={{ getDb }}>{children}</DatabaseContext.Provider>;
};

export const useDatabase = () => {
  const context = useContext(DatabaseContext);
  if (!context) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return context;
};
