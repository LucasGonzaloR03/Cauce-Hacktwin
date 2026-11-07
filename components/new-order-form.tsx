"use client";

import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Card, Row } from "@/components/ui";

type Preview = {
  amountArs: string;
  estimatedUsdt: string;
  rate: string;
  source: string;
  observedAt: string;
  quality: "live" | "cached" | "frozen";
  expiration: string;
  rateValue: number;
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
  const queryClient = useQueryClient();
  const router = useRouter();
  const [amountArs, setAmountArs] = useState("");
  const [expiration, setExpiration] = useState("24h");
  const [executionMode, setExecutionMode] = useState<"ALERT" | "AUTO_SIMULATE">("ALERT");
  const [autoConsent, setAutoConsent] = useState(false);
  const [targetRate, setTargetRate] = useState("");
  const [createError, setCreateError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
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
  const normalizedTargetRate = targetRate.trim().includes(",")
    ? targetRate.trim().replace(/\./g, "").replace(",", ".")
    : /^\d{1,3}(\.\d{3})+$/.test(targetRate.trim())
      ? targetRate.trim().replace(/\./g, "")
      : targetRate.trim();
  const targetRateValue = Number(normalizedTargetRate);
  const canCreate = Boolean(
    amountArs.trim() && data && !waitingForAmount && Number.isFinite(targetRateValue) &&
    targetRateValue > 0 && targetRateValue < data.rateValue &&
    (executionMode === "ALERT" || (autoConsent && data.quality === "live")),
  );

  async function createOrder() {
    if (!canCreate) return;
    setIsCreating(true);
    setCreateError("");
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amountArs, targetRate, expiration, executionMode, autoConsent }),
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail ?? "No se pudo crear la orden.");
      await queryClient.invalidateQueries({ queryKey: ["demo-state"] });
      await queryClient.invalidateQueries({ queryKey: ["demo-orders"] });
      router.push("/ordenes");
    } catch (failure) {
      setCreateError((failure as Error).message);
    } finally {
      setIsCreating(false);
    }
  }

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
              setAutoConsent(false);
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
        <fieldset className="order-mode-fieldset">
          <legend className="label">¿Qué querés que haga Cauce?</legend>
          <label className={`order-mode-option${executionMode === "ALERT" ? " is-selected" : ""}`}>
            <input
              type="radio"
              name="execution-mode"
              value="ALERT"
              checked={executionMode === "ALERT"}
              onChange={() => { setExecutionMode("ALERT"); setAutoConsent(false); }}
            />
            <span><strong>Avisarme</strong><small>Te avisa en la app y por email si vinculaste una cuenta verificada.</small></span>
          </label>
          <label className={`order-mode-option${executionMode === "AUTO_SIMULATE" ? " is-selected" : ""}`}>
            <input
              type="radio"
              name="execution-mode"
              value="AUTO_SIMULATE"
              checked={executionMode === "AUTO_SIMULATE"}
              onChange={() => { setExecutionMode("AUTO_SIMULATE"); setAutoConsent(false); }}
            />
            <span><strong>Comprar automáticamente</strong><small>Cauce simula la compra cuando el precio se confirma dos veces.</small></span>
          </label>
          {executionMode === "AUTO_SIMULATE" ? (
            <div className="order-auto-consent">
              <label>
                <input type="checkbox" checked={autoConsent} onChange={(event) => setAutoConsent(event.target.checked)} />
                <span>Autorizo a Cauce a simular automáticamente la compra de hasta {amountArs || "—"} ARS en USDT si el precio llega a {targetRate || "mi objetivo"} ARS/USDT antes del vencimiento.</span>
              </label>
              <p className="footnote">Solo mueve el saldo ficticio de la demo. No se envía una orden a un exchange ni se compran activos reales. Requiere dos cotizaciones nuevas en vivo.</p>
              {data && data.quality !== "live" && <p className="transfer-error" role="status">La cotización actual no está en vivo. La compra automática queda deshabilitada hasta tener un dato actual.</p>}
            </div>
          ) : (
            <p className="footnote">La detección requiere mantener Órdenes abierta. El correo se envía al email verificado si el proveedor está configurado; no hay notificaciones push.</p>
          )}
        </fieldset>
      </Card>

      <Card>
        <label className="label" htmlFor="order-target-rate">Precio objetivo · ARS por USDT</label>
        <input
          id="order-target-rate"
          className="order-target-input"
          type="text"
          inputMode="decimal"
          placeholder={data ? String(Math.floor(data.rateValue * 0.99)) : "Ej. 1.600.000"}
          value={targetRate}
          onChange={(event) => { setTargetRate(event.target.value); setAutoConsent(false); }}
          aria-describedby="order-target-help"
        />
        <p id="order-target-help" className="footnote">
          El objetivo debe ser menor que la cotización actual ({data?.rate ?? "calculando…"}).
        </p>
        {data && (
          <button
            className="order-target-suggestion"
            type="button"
            onClick={() => { setTargetRate(String(Math.floor(data.rateValue * 0.99))); setAutoConsent(false); }}
          >
            Usar objetivo 1% debajo del actual
          </button>
        )}
      </Card>

      <Card>
        <label className="label" htmlFor="order-expiration">Vencimiento de la orden</label>
        <select
          id="order-expiration"
          className="order-expiration-select"
          value={expiration}
          onChange={(event) => { setExpiration(event.target.value); setAutoConsent(false); }}
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

      {createError && <p className="transfer-error" role="alert">{createError}</p>}
      <button className="action action--primary" type="button" disabled={!canCreate || isCreating} onClick={createOrder}>
        {isCreating ? "Guardando orden…" : executionMode === "AUTO_SIMULATE" ? "Autorizar compra demo" : "Crear alerta de precio"}
      </button>
      <p className="footnote">El monto se reserva en el saldo demo mientras la orden está activa. No hay compras reales.</p>
    </>
  );
}
