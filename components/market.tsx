"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, Stamp } from "@/components/ui";

type MarketQuote = {
  id: string;
  name: string;
  detail: string;
  price: string | null;
  source: string | null;
  observedAt: string | null;
  quality: "live" | "cached" | "frozen" | null;
};

type MarketResponse = { items: MarketQuote[] };

function qualityLabel(quality: MarketQuote["quality"]) {
  if (quality === "cached") return "En caché";
  if (quality === "frozen") return "Dato antiguo";
  return "En vivo";
}

async function fetchMarket(): Promise<MarketResponse> {
  const response = await fetch("/api/market", { cache: "no-store" });
  if (!response.ok) throw new Error("No se pudo consultar el mercado");
  return response.json() as Promise<MarketResponse>;
}

export function MarketSection() {
  const { data, isError, isFetching, isLoading } = useQuery({
    queryKey: ["market"],
    queryFn: fetchMarket,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  const quotes = data?.items ?? [];
  const unavailableCount = quotes.filter((quote) => !quote.price).length;
  const staleCount = quotes.filter((quote) => quote.quality === "frozen").length;
  const disconnected = isError || (quotes.length > 0 && unavailableCount === quotes.length);
  const status = disconnected
    ? "Sin conexión"
    : isLoading
      ? "Conectando"
      : isFetching
        ? "Actualizando"
        : unavailableCount > 0 || staleCount > 0
          ? "Parcial"
          : "Actualizado";

  return (
    <section aria-labelledby="market-title">
      <div className="section-heading">
        <div><p className="label">Cotizaciones de referencia</p><h2 id="market-title">Mercado</h2></div>
        <Stamp>{status}</Stamp>
      </div>
      <Card className="market-card">
        {quotes.map((quote) => (
          <div className="market-row" key={quote.id}>
            <div><strong>{quote.name}</strong><span>{quote.detail}</span></div>
            <div className="market-price">
              <strong>{quote.price ?? "No disponible"}</strong>
              <span>
                {quote.price
                  ? `${quote.source} · ${qualityLabel(quote.quality)} · ${quote.observedAt}`
                  : "Sin respuesta de la fuente"}
              </span>
            </div>
          </div>
        ))}
        {quotes.length === 0 && (
          <p className="footnote">{isError ? "No se pudo consultar el mercado." : "Consultando cotizaciones…"}</p>
        )}
      </Card>
      <p className="footnote">
        {disconnected
          ? "No hay cotizaciones disponibles. Se volverá a intentar automáticamente."
          : "Precios de referencia, no son una oferta de compra ni de venta."}
      </p>
    </section>
  );
}