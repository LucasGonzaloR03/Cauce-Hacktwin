"use client";

import { useState, type FormEvent } from "react";
import { Card } from "@/components/ui";
import type { RuleProposal } from "@/lib/agent/types";

const actionLabels: Record<RuleProposal["action"], string> = {
  PAY: "Pagar",
  SAVE: "Ahorrar",
  INVEST: "Invertir",
  UNSUPPORTED: "Necesita revisión",
};

export function AgentRuleForm() {
  const [instruction, setInstruction] = useState("");
  const [proposal, setProposal] = useState<RuleProposal | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setProposal(null);
    try {
      const response = await fetch("/api/agent/rules/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const detail = result && typeof result === "object" && "detail" in result ? result.detail : null;
        throw new Error(typeof detail === "string" ? detail : "No se pudo interpretar la regla.");
      }
      if (!result || typeof result !== "object" || !("proposal" in result)) {
        throw new Error("La respuesta del asistente no tiene un formato válido.");
      }
      setProposal((result as { proposal: RuleProposal }).proposal);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo conectar con el asistente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="agent-rule" aria-labelledby="agent-rule-title">
      <Card>
        <p className="label">Configurá una regla</p>
        <h2 id="agent-rule-title" className="empty-title">Contale qué querés que haga</h2>
        <p className="muted">Por ejemplo: “Ahorrá 20.000 pesos por mes en dólares”.</p>
        <form className="agent-rule-form" onSubmit={submit}>
          <label className="visually-hidden" htmlFor="agent-instruction">Descripción de la regla</label>
          <textarea
            id="agent-instruction"
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            placeholder="Escribí una regla para pagar, ahorrar o invertir…"
            maxLength={500}
            minLength={5}
            required
            rows={4}
            disabled={loading}
          />
          <p className="footnote">La IA prepara una propuesta. No mueve dinero ni crea una orden.</p>
          <button className="action action--primary" type="submit" disabled={loading || instruction.trim().length < 5}>
            {loading ? "Interpretando…" : "Preparar propuesta"}
          </button>
        </form>
        {error && <p className="agent-error" role="alert">{error}</p>}
      </Card>
      {proposal && (
        <Card className="agent-proposal" aria-live="polite">
          <p className="label">Propuesta · {actionLabels[proposal.action]}</p>
          <p className="empty-title">{proposal.explanation}</p>
          {proposal.asset && <p className="muted">Activo: <strong>{proposal.asset}</strong></p>}
          {proposal.amount && <p className="muted">Monto: <strong>{proposal.amount} {proposal.currency}</strong></p>}
          {proposal.condition && <p className="muted">Condición: {proposal.condition}</p>}
          {proposal.missingInformation.length > 0 && (
            <div className="agent-missing">
              <p className="label">Falta definir</p>
              <ul>{proposal.missingInformation.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>
            </div>
          )}
          <p className="notice">Revisá cada dato. Esta propuesta no se ejecuta hasta que exista un flujo de confirmación explícita.</p>
        </Card>
      )}
    </section>
  );
}
