"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";

export type DemoBalance = { amount: number; formatted: string };

const DemoBalanceContext = createContext<{
  balance: DemoBalance;
  setBalance: Dispatch<SetStateAction<DemoBalance>>;
} | null>(null);

export function useDemoBalance() {
  const context = useContext(DemoBalanceContext);
  if (!context) throw new Error("useDemoBalance debe usarse dentro de Providers.");
  return context;
}

export function Providers({
  children,
  initialDemoBalance,
}: Readonly<{ children: ReactNode; initialDemoBalance: DemoBalance }>) {
  const [queryClient] = useState(() => new QueryClient());
  const [balance, setBalance] = useState(initialDemoBalance);

  return (
    <QueryClientProvider client={queryClient}>
      <DemoBalanceContext.Provider value={{ balance, setBalance }}>
        {children}
      </DemoBalanceContext.Provider>
    </QueryClientProvider>
  );
}
