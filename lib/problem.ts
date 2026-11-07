import { NextResponse } from "next/server";

export type ReasonCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "QUOTE_EXPIRED"
  | "QUOTE_USED"
  | "SLIPPAGE_EXCEEDED"
  | "INSUFFICIENT_FUNDS"
  | "LIMIT_EXCEEDED"
  | "KILL_SWITCH_ON"
  | "INVALID_STATE"
  | "IDEMPOTENCY_CONFLICT"
  | "IDEMPOTENCY_REQUIRED"
  | "UPSTREAM_UNAVAILABLE"
  | "RATE_LIMITED"
  | "INTERNAL";

const STATUS: Record<ReasonCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  QUOTE_EXPIRED: 410,
  QUOTE_USED: 409,
  SLIPPAGE_EXCEEDED: 409,
  INSUFFICIENT_FUNDS: 422,
  LIMIT_EXCEEDED: 422,
  KILL_SWITCH_ON: 423,
  INVALID_STATE: 409,
  IDEMPOTENCY_CONFLICT: 409,
  IDEMPOTENCY_REQUIRED: 400,
  UPSTREAM_UNAVAILABLE: 502,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

const TITLE: Record<ReasonCode, string> = {
  BAD_REQUEST: "El pedido no es válido",
  UNAUTHORIZED: "Falta la sesión",
  NOT_FOUND: "No existe",
  QUOTE_EXPIRED: "La cotización venció",
  QUOTE_USED: "La cotización ya se usó",
  SLIPPAGE_EXCEEDED: "El precio se movió demasiado",
  INSUFFICIENT_FUNDS: "Saldo insuficiente",
  LIMIT_EXCEEDED: "El monto está fuera del límite",
  KILL_SWITCH_ON: "Las órdenes están pausadas",
  INVALID_STATE: "La orden no admite esa acción",
  IDEMPOTENCY_CONFLICT: "La clave de idempotencia ya se usó con otro pedido",
  IDEMPOTENCY_REQUIRED: "Falta el header Idempotency-Key",
  UPSTREAM_UNAVAILABLE: "No hay precio disponible",
  RATE_LIMITED: "Demasiados pedidos",
  INTERNAL: "Algo se rompió de nuestro lado",
};

export class ProblemError extends Error {
  code: ReasonCode;
  detail?: string;
  extra?: Record<string, unknown>;

  constructor(code: ReasonCode, detail?: string, extra?: Record<string, unknown>) {
    super(detail ?? TITLE[code]);
    this.code = code;
    this.detail = detail;
    this.extra = extra;
  }

  get status() {
    return STATUS[this.code];
  }
}

export function problemResponse(error: unknown): NextResponse {
  if (error instanceof ProblemError) {
    return NextResponse.json(
      {
        type: `https://cauce.app/problems/${error.code.toLowerCase()}`,
        title: TITLE[error.code],
        status: error.status,
        reason_code: error.code,
        detail: error.detail ?? TITLE[error.code],
        ...error.extra,
      },
      { status: error.status, headers: { "content-type": "application/problem+json" } },
    );
  }

  console.error("[cauce] error no controlado", error);
  return NextResponse.json(
    {
      type: "https://cauce.app/problems/internal",
      title: TITLE.INTERNAL,
      status: 500,
      reason_code: "INTERNAL" as ReasonCode,
      detail: "Volvé a intentar en unos segundos.",
    },
    { status: 500, headers: { "content-type": "application/problem+json" } },
  );
}

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}
