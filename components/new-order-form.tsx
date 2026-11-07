"use client";

import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, Row } from "@/components/ui";

type Preview = {
  amountArs: string;
  estimatedUsdt: string;
  rate: string;
  source: string;
  observedAt: string;
  quality: "live" | "cached" | "frozen";
  expiration: string;
};

const expirationOptions = [
  { value: "1h", label: "1 hora" },
  { value: "24h", label: "24 horas" },
  { value: "7d", label: "7 días" },
  { value: "gtc", label: "Hasta cancelar (GTC)" },
];

function qualityLabel(quality: Preview["quality"]) {
  if (quality === "cached") return "En caché";
  if (quality === "frozen") return "Dato antiguo";
  return "En vivo";
}

async function fetchPreview(amountArs: string, expiration: string): Promise<Preview> {
  const response = await fetch("/api/orders/preview", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ amountArs, expiration }),
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail ?? "No se pudo calcular el preview.");
  return data as Preview;
}

export function NewOrderForm() {
  const [amountArs, setAmountArs] = useState("");
  const [expiration, setExpiration] = useState("24h");
  const [debouncedAmount, setDebouncedAmount] = useState("");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data, error, isFetching, isError } = useQuery({
    queryKey: ["order-preview", debouncedAmount, expiration],
    queryFn: () => fetchPreview(debouncedAmount, expiration),
    enabled: Boolean(debouncedAmount.trim()),
    refetchInterval: 30_000,
    retry: false,
  });

  const waitingForAmount = amountArs.trim() !== debouncedAmount.trim();

  return (
    <>
      <Card>
        <label className="label" htmlFor="order-amount">Invertís en pesos</label>
        <div className="order-amount-field">
          <span>ARS</span>
          <input
            id="order-amount"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="100.000"
            value={amountArs}
            onChange={(event) => {
              const nextAmount = event.target.value;
              setAmountArs(nextAmount);
              if (debounceTimer.current) clearTimeout(debounceTimer.current);
              debounceTimer.current = setTimeout(() => setDebouncedAmount(nextAmount), 300);
            }}
            aria-describedby="order-amount-help"
          />
        </div>
        <p id="order-amount-help" className="footnote">Escribí el monto en pesos; aceptamos coma decimal.</p>
      </Card>

      <Card className="order-estimate" aria-live="polite">
        <p className="label">Recibirías aproximadamente</p>
        {!amountArs.trim() ? (
          <p className="order-estimate-value">— <small>USDT</small></p>
        ) : waitingForAmount || (isFetching && !data) ? (
          <p className="muted">Calculando con la cotización actual…</p>
        ) : isError ? (
          <p className="muted">{(error as Error).message}</p>
        ) : data ? (
          <>
            <p className="order-estimate-value">{data.estimatedUsdt}</p>
            <p className="muted">Según 1 USDT = {data.rate}</p>
            <p className="footnote">{data.source} · {qualityLabel(data.quality)} · {data.observedAt}</p>
          </>
        ) : null}
      </Card>

      <Card>
        <label className="label" htmlFor="order-expiration">Vencimiento de la orden</label>
        <select
          id="order-expiration"
          className="order-expiration-select"
          value={expiration}
          onChange={(event) => setExpiration(event.target.value)}
        >
          {expirationOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        {data && (
          <div className="order-expiration-detail">
            <Row label="Duración" value={data.expiration} />
            <p className="footnote">El conteo empieza cuando se crea la orden.</p>
          </div>
        )}
      </Card>
    </>
  );
}