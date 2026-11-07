export type DemoBalance = { amount: number; formatted: string };

export type DemoTransferRecord = {
  simulationId: string;
  simulatedAt: string;
  amountArs: number;
  amountArsFormatted: string;
  feeArs: number;
  feeArsFormatted: string;
  feeRatePercent: number;
  usdtAmount: number;
  usdtAmountFormatted: string;
  receivedAmount: number;
  receivedAmountFormatted: string;
  destination: { code: string; name: string; currency: string; currencyName: string };
  route: string;
  exchangeRateFormatted: string;
  source: string;
  observedAt: string;
  quality: "live" | "cached" | "frozen";
  routeNote: string;
  canSimulate: boolean;
  journey: { title: string; detail: string }[];
};

export type DemoTransferSnapshot = DemoTransferRecord & {
  balanceAfterArs: number;
  balanceAfterFormatted: string;
};

export type DemoState = {
  balance: DemoBalance;
  simulations: DemoTransferSnapshot[];
};

export type DemoOrderRecord = {
  id: string;
  amountArs: number;
  amountArsFormatted: string;
  estimatedUsdt: string;
  targetRate: number;
  targetRateFormatted: string;
  referenceRate: number;
  referenceRateFormatted: string;
  expirationCode: string;
  expiration: string;
  status: string;
  isMock: boolean;
  source: string;
  quality: "live" | "cached" | "frozen";
  observedAt: string;
  createdAt: string;
  expiresAt: string | null;
};