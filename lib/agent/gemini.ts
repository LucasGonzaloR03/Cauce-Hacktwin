import "server-only";
import { GoogleGenAI } from "@google/genai";
import type { RuleProposal } from "./types";

const responseSchema = {
  type: "object",
  properties: {
    action: { type: "string", enum: ["PAY", "SAVE", "INVEST", "UNSUPPORTED"] },
    asset: { type: "string" },
    amount: { type: "string" },
    currency: { type: "string", enum: ["ARS", "USD", "USDT", "BTC", "UNKNOWN"] },
    condition: { type: "string" },
    explanation: { type: "string" },
    missingInformation: { type: "array", items: { type: "string" } },
  },
  required: ["action", "asset", "amount", "currency", "condition", "explanation", "missingInformation"],
  additionalProperties: false,
} as const;

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");
  return new GoogleGenAI({ apiKey });
}

function isRuleProposal(value: unknown): value is RuleProposal {
  if (!value || typeof value !== "object") return false;
  const proposal = value as Record<string, unknown>;
  return (
    ["PAY", "SAVE", "INVEST", "UNSUPPORTED"].includes(String(proposal.action)) &&
    typeof proposal.asset === "string" && proposal.asset.length <= 40 &&
    typeof proposal.amount === "string" && proposal.amount.length <= 32 &&
    ["ARS", "USD", "USDT", "BTC", "UNKNOWN"].includes(String(proposal.currency)) &&
    typeof proposal.condition === "string" && proposal.condition.length <= 240 &&
    typeof proposal.explanation === "string" && proposal.explanation.length <= 400 &&
    Array.isArray(proposal.missingInformation) && proposal.missingInformation.length <= 5 &&
    proposal.missingInformation.every((item) => typeof item === "string" && item.length <= 120)
  );
}

export async function interpretRule(instruction: string): Promise<RuleProposal> {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || "gemini-3-flash-preview",
    contents: [{ role: "user", parts: [{ text: instruction }] }],
    config: {
      systemInstruction: [
        "Sos el asistente de configuración de Cauce, una app financiera argentina.",
        "Convertí el pedido en una propuesta estructurada de regla para pagar, ahorrar o invertir.",
        "No ejecutes movimientos, no confirmes que algo se ejecutó y no inventes montos, activos, condiciones ni datos faltantes.",
        "Si el pedido no expresa una acción compatible, usa UNSUPPORTED e indica qué dato falta en missingInformation.",
        "Conserva el monto como texto, sin recalcularlo. Usa UNKNOWN cuando no se indicó moneda.",
        "La explicación debe ser breve, en español rioplatense y describir la propuesta, no recomendar una inversión.",
      ].join(" "),
      responseMimeType: "application/json",
      responseSchema,
      temperature: 0.1,
      maxOutputTokens: 500,
      automaticContinuation: false,
    },
  });

  const text = response.text;
  if (!text) throw new Error("Gemini returned an empty response");
  const parsed: unknown = JSON.parse(text);
  if (!isRuleProposal(parsed)) throw new Error("Gemini returned an invalid rule proposal");
  return parsed;
}
