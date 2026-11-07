"use client";

import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDemoBalance } from "@/app/providers";
import { Action, Card, Row, Stamp } from "@/components/ui";

type DestinationCode = string;

type DestinationOption = {
  code: DestinationCode;
  name: string;
  currency: string;
  currencyName: string;
};

type TransferPreview = {
  amountArs: number;
  amountArsFormatted: string;
  feeArsFormatted: string;
  feeRatePercent: number;
  usdtAmountFormatted: string;
  receivedAmountFormatted: string;
  destination: { code: DestinationCode; name: string; currency: string; currencyName: string };
  route: string;
  exchangeRateFormatted: string;
  source: string;
  observedAt: string;
  quality: "live" | "cached" | "frozen";
  routeNote: string;
  canSimulate: boolean;
};

type Simulation = TransferPreview & {
  simulationId: string;
  simulatedAt: string;
  balanceAfterArs: number;
  balanceAfterFormatted: string;
  journey: { title: string; detail: string }[];
};

type ApiError = { detail: string };

function qualityLabel(quality: TransferPreview["quality"]) {
  if (quality === "cached") return "En caché";
  if (quality === "frozen") return "Dato antiguo";
  return "En vivo";
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) throw new Error((data as ApiError).detail ?? "No se pudo completar la consulta.");
  return data as T;
}

export function DemoBalanceSummary() {
  const { balance } = useDemoBalance();
  return <p className="amount">{balance.formatted} <small>ARS</small></p>;
}

export function TransferFlow({ destinations }: { destinations: DestinationOption[] }) {
  const { balance, setBalance } = useDemoBalance();
  const [amountArs, setAmountArs] = useState("");
  const [destination, setDestination] = useState<DestinationCode>("CO");
  const [debouncedAmount, setDebouncedAmount] = useState("");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [simulation, setSimulation] = useState<Simulation | null>(null);
  const [simulationError, setSimulationError] = useState("");
  const [isSimulating, setIsSimulating] = useState(false);
  const destinationPickerRef = useRef<HTMLDetailsElement>(null);
  const selectedDestination = destinations.find((option) => option.code === destination);

  const { data: preview, error, isError, isFetching } = useQuery({
    queryKey: ["transfer-preview", debouncedAmount, destination, balance.amount],
    queryFn: () => postJson<TransferPreview>("/api/transfers/preview", {
      amountArs: debouncedAmount,
      destination,
      demoBalanceArs: balance.amount,
    }),
    enabled: Boolean(debouncedAmount.trim() && selectedDestination),
    refetchInterval: 30_000,
    retry: false,
  });

  const waitingForAmount = amountArs.trim() !== debouncedAmount.trim();
  const canSimulate = Boolean(preview?.canSimulate && !waitingForAmount && !isFetching && !isError);

  async function simulateTransfer() {
    if (!canSimulate) return;
    setIsSimulating(true);
    setSimulationError("");
    try {
      const result = await postJson<Simulation>("/api/transfers/simulate", {
        amountArs,
        destination,
        demoBalanceArs: balance.amount,
      });
      setBalance({ amount: result.balanceAfterArs, formatted: result.balanceAfterFormatted });
      setSimulation(result);
    } catch (simulationFailure) {
      setSimulationError((simulationFailure as Error).message);
    } finally {
      setIsSimulating(false);
    }
  }

  return (
    <div className="transfer-flow">
      <Card className="demo-wallet">
        <div>
          <p className="label">Saldo para probar</p>
          <strong>{balance.formatted} ARS</strong>
          <p className="footnote">Saldo de prueba para explorar el recorrido.</p>
        </div>
        <Stamp>Demo</Stamp>
      </Card>

      <Card>
        <p className="label" id="transfer-destination-label">Enviás a</p>
        <details className="destination-picker" ref={destinationPickerRef}>
          <summary
            id="transfer-destination"
            className="destination-trigger"
            aria-labelledby="transfer-destination-label transfer-destination-value"
          >
            <span id="transfer-destination-value">
              {selectedDestination
                ? `${selectedDestination.name} · ${selectedDestination.currency}`
                : "Elegí un país"}
            </span>
            <span className="destination-chevron" aria-hidden="true">⌄</span>
          </summary>
          <div className="destination-options" role="group" aria-labelledby="transfer-destination-label">
            {destinations.map((option) => (
              <button
                key={option.code}
                className="destination-option"
                type="button"
                aria-pressed={destination === option.code}
                onClick={() => {
                  setDestination(option.code);
                  setSimulation(null);
                  setSimulationError("");
                  if (destinationPickerRef.current) destinationPickerRef.current.open = false;
                }}
              >
                <span>{option.name}</span>
                <span className="destination-currency">{option.currency}</span>
              </button>
            ))}
          </div>
        </details>
        <p className="footnote">Origen: Argentina · se entrega en moneda local a un destino simulado.</p>
      </Card>

      <Card>
        <label className="label" htmlFor="transfer-amount">¿Cuánto enviás en pesos?</label>
        <div className="order-amount-field">
          <span>ARS</span>
          <input
            id="transfer-amount"
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
              setSimulation(null);
              setSimulationError("");
            }}
          />
        </div>
        <p className="footnote">La comisión demo del 1% se descuenta antes de convertir.</p>
      </Card>

      <Card className="transfer-receipt" aria-live="polite">
        <div className="section-heading">
          <p className="label">Recibe aproximadamente</p>
          {preview && <Stamp>{qualityLabel(preview.quality)}</Stamp>}
        </div>
        {!amountArs.trim() ? (
          <p className="transfer-received">— <small>{selectedDestination?.currency ?? ""}</small></p>
        ) : waitingForAmount || (isFetching && !preview) ? (
          <p className="muted">Calculando conversión…</p>
        ) : isError ? (
          <p className="muted">{(error as Error).message}</p>
        ) : preview ? (
          <>
            <p className="transfer-received">{preview.receivedAmountFormatted}</p>
            <p className="muted">{preview.exchangeRateFormatted} · {preview.source} · {preview.observedAt}</p>
            <div className="transfer-breakdown">
              <Row label="Enviás" value={preview.amountArsFormatted} />
              <Row label={`Comisión (${preview.feeRatePercent}%)`} value={preview.feeArsFormatted} />
              <Row label="Se convierte" value={preview.usdtAmountFormatted} />
            </div>
            <p className="footnote">{preview.routeNote}</p>
            {!preview.canSimulate && <p className="transfer-error">El monto supera el saldo demo disponible.</p>}
          </>
        ) : null}
      </Card>

      {simulationError && <p className="transfer-error" role="alert">{simulationError}</p>}

      {simulation ? (
        <Card className="transfer-simulation">
          <div className="section-heading">
            <div><p className="label">Recorrido completado</p><p className="empty-title">Simulación · {simulation.simulatedAt}</p></div>
            <Stamp>Sin envío real</Stamp>
          </div>
          <div className="timeline">
            {simulation.journey.map((step) => (
              <div key={step.title}><strong>{step.title}</strong><p>{step.detail}</p></div>
            ))}
          </div>
          <Row label="Saldo demo restante" value={`${simulation.balanceAfterFormatted} ARS`} />
          <p className="footnote">Comprobante de simulación: {simulation.simulationId.slice(0, 8)}</p>
        </Card>
      ) : (
        <>
          <p className="label section-label">Recorrido de la plata</p>
          <div className="timeline transfer-route">
            <div><strong>Pesos argentinos</strong><p>Saldo demo de origen</p></div>
            <div><strong>USDT</strong><p>Conversión de referencia con Bitso</p></div>
            <div><strong>{selectedDestination?.currencyName ?? "Moneda local"}</strong><p>Conversión al tipo de cambio disponible</p></div>
            <div><strong>Destino demo</strong><p>Sin acreditación ni payout real</p></div>
          </div>
        </>
      )}

      <Action disabled={!canSimulate || isSimulating || Boolean(simulation)} onClick={simulateTransfer}>
        {isSimulating ? "Simulando…" : simulation ? "Simulación lista" : "Simular transferencia"}
      </Action>
      {simulation && (
        <Action
          variant="outline"
          onClick={() => {
            setSimulation(null);
            setAmountArs("");
            if (debounceTimer.current) clearTimeout(debounceTimer.current);
            setDebouncedAmount("");
            setSimulationError("");
          }}
        >
          Nueva simulación
        </Action>
      )}
      <p className="footnote">La demo no transfiere dinero ni crea una operación real.</p>
    </div>
  );
}