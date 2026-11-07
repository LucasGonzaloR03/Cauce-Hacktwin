"use client";

import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import type { DemoBalance, DemoState } from "@/lib/demo-types";

export type { DemoTransferSnapshot } from "@/lib/demo-types";

export type Theme = "light" | "dark";

const ThemeContext = createContext<{ theme: Theme; toggleTheme: () => void } | null>(null);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme debe usarse dentro de Providers.");
  return context;
}

const demoStateKey = ["demo-state"] as const;

async function fetchDemoState(): Promise<DemoState> {
  const response = await fetch("/api/demo/state", { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail ?? "No se pudo cargar el estado de la demo.");
  return data as DemoState;
}

const DemoBalanceContext = createContext<{
  balance: DemoBalance | null;
  balanceError: string | null;
  simulations: DemoState["simulations"];
  setBalance: Dispatch<SetStateAction<DemoBalance>>;
  refreshDemoState: () => Promise<void>;
} | null>(null);

export function useDemoBalance() {
  const context = useContext(DemoBalanceContext);
  if (!context) throw new Error("useDemoBalance debe usarse dentro de Providers.");
  return context;
}

export function Providers({ children, initialTheme }: Readonly<{ children: ReactNode; initialTheme: Theme }>) {
  const [queryClient] = useState(() => new QueryClient());
  const [theme, setTheme] = useState(initialTheme);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    document.cookie = `cauce_theme=${nextTheme}; Path=/; Max-Age=31536000; SameSite=Lax${window.location.protocol === "https:" ? "; Secure" : ""}`;
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute(
      "content",
      nextTheme === "dark" ? "#111111" : "#ffffff",
    );
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <QueryClientProvider client={queryClient}>
        <DemoStateProvider>{children}</DemoStateProvider>
      </QueryClientProvider>
    </ThemeContext.Provider>
  );
}

function DemoStateProvider({ children }: Readonly<{ children: ReactNode }>) {
  const queryClient = useQueryClient();
  const demoState = useQuery({ queryKey: demoStateKey, queryFn: fetchDemoState, retry: false });

  function setBalance(nextBalance: SetStateAction<DemoBalance>) {
    queryClient.setQueryData<DemoState>(demoStateKey, (current) => {
      if (!current) {
        return typeof nextBalance === "function" ? current : { balance: nextBalance, simulations: [] };
      }
      return {
        ...current,
        balance: typeof nextBalance === "function" ? nextBalance(current.balance) : nextBalance,
      };
    });
  }

  async function refreshDemoState() {
    await queryClient.invalidateQueries({ queryKey: demoStateKey });
  }

  return (
    <DemoBalanceContext.Provider value={{
      balance: demoState.data?.balance ?? null,
      balanceError: demoState.isError ? (demoState.error as Error).message : null,
      simulations: demoState.data?.simulations ?? [],
      setBalance,
      refreshDemoState,
    }}>
      {children}
    </DemoBalanceContext.Provider>
  );
}
