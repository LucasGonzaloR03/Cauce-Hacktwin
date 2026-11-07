"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { Card, Row, Stamp } from "@/components/ui";
import type { DemoOrderRecord } from "@/lib/demo-types";

async function fetchOrders(): Promise<DemoOrderRecord[]> {
  const response = await fetch("/api/orders", { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail ?? "No se pudieron cargar las órdenes.");
  return data.orders as DemoOrderRecord[];
}

async function deleteOrder(id: string) {
  const response = await fetch(`/api/orders/${id}`, { method: "DELETE", cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail ?? "No se pudo eliminar la orden.");
}

export function OrdersList() {
  const queryClient = useQueryClient();
  const orders = useQuery({ queryKey: ["demo-orders"], queryFn: fetchOrders, retry: false });
  const deletion = useMutation({
    mutationFn: deleteOrder,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["demo-orders"] }),
        queryClient.invalidateQueries({ queryKey: ["demo-state"] }),
      ]);
    },
  });

  if (orders.isPending) return <p className="muted">Cargando tus órdenes…</p>;
  if (orders.isError) return <p className="transfer-error" role="alert">{(orders.error as Error).message}</p>;
  if (!orders.data.length) {
    return <Card className="empty-state"><p className="empty-title">Todavía no hay órdenes</p><p className="muted">Las órdenes demo que armes van a aparecer acá.</p></Card>;
  }

  return (
    <div className="order-list">
      {orders.data.map((order) => (
        <Card className="order-list-item" key={order.id}>
          <div className="order-list-header">
            <div>
              <p className="label">{order.isMock ? "Orden de muestra" : "Orden demo"}</p>
              <p className="order-list-target">{order.targetRateFormatted}<small> ARS / USDT</small></p>
            </div>
            <Stamp>{order.isMock ? "Muestra" : order.status === "ARMED" ? "Armada" : order.status}</Stamp>
          </div>
          <Row label="Monto reservado" value={order.amountArsFormatted} />
          <Row label="Recibirías al objetivo" value={order.estimatedUsdt} />
          <Row label="Vencimiento" value={order.expiresAt ?? order.expiration} />
          <p className="footnote">{order.createdAt} · {order.source} · {order.quality === "frozen" ? "Dato antiguo" : order.quality === "cached" ? "En caché" : "En vivo"}</p>
          <button
            className="order-delete-button"
            type="button"
            aria-label={`Eliminar orden con objetivo ${order.targetRateFormatted}`}
            title="Eliminar orden"
            disabled={deletion.isPending}
            onClick={() => deletion.mutate(order.id)}
          >
            <Trash2 size={16} aria-hidden="true" />
            <span>{deletion.isPending && deletion.variables === order.id ? "Eliminando…" : "Eliminar orden"}</span>
          </button>
          {deletion.isError && deletion.variables === order.id && (
            <p className="transfer-error" role="alert">{(deletion.error as Error).message}</p>
          )}
        </Card>
      ))}
    </div>
  );
}