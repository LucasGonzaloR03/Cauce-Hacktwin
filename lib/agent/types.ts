export type RuleProposal = {
  action: "PAY" | "SAVE" | "INVEST" | "UNSUPPORTED";
  asset: string;
  amount: string;
  currency: "ARS" | "USD" | "USDT" | "BTC" | "UNKNOWN";
  condition: string;
  explanation: string;
  missingInformation: string[];
};
