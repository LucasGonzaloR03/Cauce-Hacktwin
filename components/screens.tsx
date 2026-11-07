import type { ComponentType, ReactNode } from "react";
import { Action, Card, QuickAction, Row, Shell, Stamp } from "@/components/ui";
import { MarketSection } from "@/components/market";
import { NewOrderForm } from "@/components/new-order-form";
import { OrdersList } from "@/components/orders";
import { ThemeToggle } from "@/components/theme-toggle";
import { DemoBalanceSummary, TransferFlow } from "@/components/transfer-flow";
import { transferDestinations } from "@/lib/transfer-preview";

const transferDestinationOptions = Object.values(transferDestinations).map((destination) => ({
  code: destination.code,
  name: destination.name,
  currency: destination.currency,
  currencyName: destination.currencyName,
}));
import { AgentRuleForm } from "@/components/agent-rule-form";
import { AuthPanel } from "@/components/auth-panel";
import { AuthSessionBadge } from "@/components/auth-session-badge";

function Intro({ eyebrow, title, children }: { eyebrow?: string; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="intro">
      {eyebrow && <p className="label">{eyebrow}</p>}
      <h1>{title}</h1>
      {children && <p className="muted">{children}</p>}
    </div>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return <p className="notice">{children}</p>;
}

export function HomeScreen() {
  return (
    <Shell active="home" title="Tu dinero, a tu ritmo">
      <h1 className="visually-hidden">Inicio</h1>
      <AuthSessionBadge />
      <div className="balance">
        <p className="label">Tu saldo · demo, sin custodia</p>
        <DemoBalanceSummary />
        <p className="muted">Saldo de prueba para explorar conversiones. No representa fondos disponibles.</p>
      </div>
      <section aria-label="Acciones principales" className="quick-grid">
        <QuickAction icon="＋" title="Ingresar demo" description="Sin ingreso de fondos" href="/acceso" />
        <QuickAction icon="→" title="Transferir" description="Nacional o exterior" href="/transferir" />
        <QuickAction icon="◎" title="Fijar precio" description="Comprar a tu precio" href="/nueva-orden" />
      </section>
      <Card className="alias">
        <div><p className="label">Alias ilustrativo · no recibe fondos</p><strong className="mono">Sin alias asignado</strong></div>
        <Stamp>Demo</Stamp>
      </Card>
      <MarketSection />
      <Card className="horizontal">
        <div><p className="label">Ahorro activo</p><p className="muted">Consultá tus órdenes de demo</p></div>
        <Action href="/ordenes" variant="outline">Ver órdenes</Action>
      </Card>
    </Shell>
  );
}

export function AccessScreen() {
  return (
    <main className="login-shell">
      <header className="login-topbar">
        <span className="wordmark">Cauce</span>
        <div className="login-topbar-actions">
          <ThemeToggle />
          <span className="pill"><span className="flag" aria-hidden="true" /> AR</span>
        </div>
      </header>
      <div className="login-hero">
        <span className="login-logo">Cauce</span>
        <p>El dinero corre por donde vos decidís. Al precio que vos fijás.</p>
      </div>
      <AuthPanel />
      <Card className="login-details">
        <Row label="Riel de referencia" value="MEP + Bitso" />
        <Row label="Fondos" value="No se reciben" />
        <Row label="Operaciones" value="Solo demo" />
      </Card>
      <div className="login-footer">
        <Action href="/inicio">Entrar a la demo</Action>
        <p className="footnote">Vinculá tu email para conservar tus datos en otros dispositivos.</p>
      </div>
    </main>
  );
}

function TransferScreen() {
  return (
    <Shell active="transferir" title="Transferencia">
      <Intro eyebrow="Transferencia · simulación" title="¿Cuánto mandás?">Elegí el destino, revisá el cambio y seguí el recorrido completo de la plata.</Intro>
      <TransferFlow destinations={transferDestinationOptions} />
    </Shell>
  );
}

function ArrivalScreen() {
  return (
    <Shell active="transferir" back="/transferir" title="Cómo llega">
      <Intro eyebrow="Ruta ilustrativa · AR → CO" title="El camino de tu plata">Esta vista muestra una posibilidad de diseño, no un servicio habilitado.</Intro>
      <div className="timeline">
        <div><strong>Desde Argentina</strong><p>Se calcularía el débito en pesos.</p></div>
        <div><strong>Conversión digital</strong><p>Se informaría el activo y el costo de red.</p></div>
        <div><strong>Destino en Colombia</strong><p>Se mostraría el importe y el riel de llegada.</p></div>
      </div>
      <Card><Row label="Importe a recibir" value="No disponible" /><Row label="Costo total" value="No disponible" /><Row label="Cotización" value="No disponible" /></Card>
      <Notice>Los rieles y tiempos requieren confirmación del backend y de los proveedores.</Notice>
      <Action href="/costo">Ver el costo detallado</Action>
    </Shell>
  );
}

function CostScreen() {
  return (
    <Shell active="transferir" back="/como-llega" title="El costo real">
      <Intro eyebrow="Transparencia, primero" title="Cada costo, claro.">El desglose se completa cuando haya una cotización disponible.</Intro>
      <Card><Row label="Enviás" value="No disponible" /><Row label="Se debita" value="No disponible" /><Row label="Comisión" value="No disponible" /><Row label="Riel y red" value="No disponible" /><Row label="Recibe" value="No disponible" /></Card>
      <p className="footnote">Sin fuente ni hora de cotización. No se muestran valores estimados.</p>
      <Action href="/verificar">Ver revisión de ejemplo</Action>
    </Shell>
  );
}

function VerifyScreen() {
  return (
    <Shell active="transferir" back="/costo" title="Revisar transferencia">
      <Intro eyebrow="Vista previa · sin operación" title={<>Verificá los datos<br />antes de transferir</>} />
      <Card><p className="label">Destinatario</p><p className="empty-title">Sin destinatario</p><p className="muted">Los datos se mostrarán al conectar el flujo de transferencias.</p></Card>
      <Card><Row label="Monto que recibe" value="No disponible" /><Row label="Se debita" value="No disponible" /><Row label="Cotización" value="No disponible" /><Row label="Costo total" value="No disponible" /></Card>
      <Notice>No se creó ni se confirmó ninguna transferencia.</Notice>
      <Action disabled>Simular envío · no disponible</Action>
      <Action href="/comprobante" variant="outline">Ver comprobante de muestra</Action>
    </Shell>
  );
}

function ReceiptScreen() {
  return (
    <Shell active="transferir" back="/verificar" title="Comprobante">
      <div className="hero"><span className="checkmark">✓</span><p className="label">Muestra de diseño</p><h1>Transferencia simulada</h1><p>No corresponde a una operación realizada.</p></div>
      <Card><Row label="Destinatario" value="Dato de muestra" /><Row label="Monto" value="No disponible" /><Row label="Estado" value="Sin operación" /><Row label="Fecha" value="No disponible" /></Card>
      <Notice>La demo no transfiere fondos ni acredita dinero.</Notice>
      <Action href="/comprobante-vista">Ver vista previa</Action>
      <Action href="/inicio" variant="outline">Volver al inicio</Action>
    </Shell>
  );
}

function ReceiptPreviewScreen() {
  return (
    <Shell active="transferir" back="/comprobante" title="Comprobante">
      <h1 className="visually-hidden">Vista previa del comprobante</h1>
      <Card className="ticket">
        <div className="horizontal"><span className="wordmark">Cauce</span><Stamp>Muestra</Stamp></div>
        <div className="ticket-hero"><p className="label">Transferencia simulada</p><p className="amount">— <small>COP</small></p><p className="muted">Sin operación realizada</p></div>
        <p className="label">Transferencia</p>
        <Row label="Desde" value="Sesión demo" /><Row label="Hacia" value="Destinatario demo" /><Row label="Fecha" value="No disponible" />
        <p className="label section-label">Costo y cotización</p>
        <Row label="Cotización" value="No disponible" /><Row label="Costo total" value="No disponible" />
        <p className="footnote">Muestra de diseño · No es un comprobante de pago ni una constancia verificable.</p>
      </Card>
      <Action disabled>Descargar PDF · no disponible</Action>
      <Action disabled variant="outline">Compartir · no disponible</Action>
    </Shell>
  );
}

function NewOrderScreen() {
  return (
    <Shell active="ordenes" back="/ordenes" title="Nueva orden">
      <Intro eyebrow="Regla de precio · demo" title={<>¿Cuánto querés<br />poner en pesos?</>}>Calculá el equivalente en USDT y elegí si querés un aviso o una compra simulada automática.</Intro>
      <NewOrderForm />
    </Shell>
  );
}

function OrderScreen() {
  return (
    <Shell active="ordenes" back="/ordenes" title="La orden">
      <Intro eyebrow="Órdenes demo" title="Tus órdenes">Las muestras y las órdenes que armes quedan asociadas a tu sesión.</Intro>
      <OrdersList />
      <Action href="/nueva-orden">Armar orden</Action>
    </Shell>
  );
}

function OrdersScreen() {
  return (
    <Shell active="ordenes" title="Órdenes">
      <Intro eyebrow="Tu actividad" title="Tus recibos">Consultá tus órdenes y comprobantes en un solo lugar.</Intro>
      <OrdersList />
      <Action href="/nueva-orden">Explorar nueva orden</Action>
    </Shell>
  );
}

function AgentScreen() {
  return (
    <Shell active="agente" title="Copiloto">
      <Intro eyebrow="Reglas bajo tu control · sandbox" title={<>Decidí qué querés<br />que haga tu agente</>}>Describí una regla y revisá cómo la interpreta antes de cualquier acción.</Intro>
      <AgentRuleForm />
      <Card><p className="label">Cómo funciona</p><p className="muted">Gemini interpreta tu instrucción. Cauce valida y explica una propuesta; el motor financiero y una confirmación explícita son necesarios antes de ejecutar movimientos.</p></Card>
      <Action href="/ordenes" variant="outline">Ir a órdenes</Action>
    </Shell>
  );
}

export const screens: Record<string, ComponentType> = {
  inicio: HomeScreen,
  acceso: AccessScreen,
  transferir: TransferScreen,
  "como-llega": ArrivalScreen,
  costo: CostScreen,
  verificar: VerifyScreen,
  comprobante: ReceiptScreen,
  "comprobante-vista": ReceiptPreviewScreen,
  "nueva-orden": NewOrderScreen,
  "la-orden": OrderScreen,
  ordenes: OrdersScreen,
  agente: AgentScreen,
};
