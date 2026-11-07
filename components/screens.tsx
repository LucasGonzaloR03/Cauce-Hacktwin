import type { ComponentType, ReactNode } from "react";
import { Action, Card, QuickAction, Row, Shell, Stamp } from "@/components/ui";

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

const marketItems = [
  { name: "MEP", detail: "Bolsa", source: "Fuente prevista: DolarAPI" },
  { name: "USDT", detail: "Cripto", source: "Fuente a confirmar" },
  { name: "Dólar tarjeta", detail: "Referencia", source: "Fuente prevista: DolarAPI" },
  { name: "BTC / ARS", detail: "Cripto", source: "Fuente a confirmar" },
];

function MarketCard({ name, detail, source }: { name: string; detail: string; source: string }) {
  return (
    <div className="market-row">
      <div><strong>{name}</strong><span>{detail} · {source}</span></div>
      <div className="market-price"><strong>No disponible</strong><span>Sin hora de actualización</span></div>
    </div>
  );
}

export function HomeScreen() {
  return (
    <Shell active="home" title="Tu dinero, a tu ritmo">
      <h1 className="visually-hidden">Inicio</h1>
      <div className="balance">
        <p className="label">Tu saldo · demo, sin custodia</p>
        <p className="amount">— <small>ARS</small></p>
        <p className="muted">Saldo no disponible. La demo no recibe ni custodia fondos.</p>
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
      <section aria-labelledby="market-title">
        <div className="section-heading">
          <div><p className="label">Cotizaciones de referencia</p><h2 id="market-title">Mercado</h2></div>
          <Stamp>Sin conexión</Stamp>
        </div>
        <Card className="market-card">
          {marketItems.map((item) => <MarketCard key={item.name} {...item} />)}
        </Card>
        <p className="footnote">Las cotizaciones aparecerán cuando esté disponible la API de Cauce. No hay precios ni horas de actualización para mostrar.</p>
      </section>
      <Card className="horizontal">
        <div><p className="label">Ahorro activo</p><p className="muted">Consultá tus órdenes de demo</p></div>
        <Action href="/ordenes" variant="outline">Ver órdenes</Action>
      </Card>
    </Shell>
  );
}

function AccessScreen() {
  return (
    <Shell back="/" title="Acceso">
      <h1 className="visually-hidden">Acceso a la demo</h1>
      <div className="hero"><span className="hero-logo">Cauce</span><p>El dinero corre por donde vos decidís. Al precio que vos fijás.</p></div>
      <Card><p className="label">Sesión de demostración</p><p className="muted">Explorá la interfaz sin instalar la app ni iniciar sesión.</p></Card>
      <Card><Row label="Fondos" value="No se reciben" /><Row label="Operaciones" value="Solo demostración" /><Row label="Acceso" value="Sin registro" /></Card>
      <Action href="/">Entrar a la demo</Action>
      <p className="footnote">El acceso con magic link y la verificación de identidad todavía no están disponibles.</p>
    </Shell>
  );
}

function TransferScreen() {
  return (
    <Shell active="transferir" title="Transferencia">
      <Intro eyebrow="Transferencia · vista previa" title="¿Cuánto mandás?">Conocé cómo sería una transferencia sin mover fondos.</Intro>
      <Card>
        <p className="label">Destino</p>
        <p className="destination">Argentina <span>→</span> Colombia</p>
        <p className="muted">Ruta ilustrativa · no disponible para operar</p>
      </Card>
      <Card>
        <label className="label" htmlFor="transfer-amount">Monto en dólares</label>
        <input id="transfer-amount" className="amount-input" type="text" inputMode="decimal" placeholder="0,00" disabled />
        <p className="footnote">No se puede cotizar hasta conectar el backend.</p>
      </Card>
      <section>
        <p className="label section-label">¿Cómo querés que llegue?</p>
        <Card><Row label="Pesos colombianos" value="Vista previa" /><Row label="Dólares en cuenta" value="No disponible" /><Row label="Dólar digital" value="No disponible" /></Card>
      </section>
      <Notice>Demo informativa: no hay débito, conversión ni acreditación real.</Notice>
      <Action href="/como-llega">Conocer cómo llega</Action>
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
      <Action href="/" variant="outline">Volver al inicio</Action>
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
      <Intro eyebrow="Orden condicional · vista previa" title={<>¿A qué precio<br />querés comprar?</>}>Definí tu objetivo cuando el servicio esté disponible.</Intro>
      <Card>
        <label className="label" htmlFor="target-price">Precio objetivo · ARS por USDT</label>
        <input className="amount-input" id="target-price" type="text" inputMode="decimal" placeholder="0,00" disabled />
      </Card>
      <div className="two-columns">
        <Card><p className="label">Cantidad</p><p className="empty-title">— USDT</p></Card>
        <Card><p className="label">Vencimiento</p><p className="empty-title">No disponible</p></Card>
      </div>
      <Notice>Sin cotización, límites ni consentimiento no se puede crear una orden. No se realiza ninguna compra.</Notice>
      <Action disabled>Armar orden · no disponible</Action>
      <Action href="/la-orden" variant="outline">Ver seguimiento de muestra</Action>
    </Shell>
  );
}

function OrderScreen() {
  return (
    <Shell active="ordenes" back="/ordenes" title="La orden">
      <Intro eyebrow="Seguimiento · muestra" title="Esperando el precio">Esta pantalla es una vista previa; no hay una orden activa.</Intro>
      <Card><p className="label">Cotización actual USDT</p><p className="amount">— <small>ARS</small></p><p className="footnote">Sin fuente ni hora de actualización.</p></Card>
      <div className="timeline">
        <div><strong>Orden armada</strong><p>No disponible en esta demo.</p></div>
        <div><strong>Esperando el precio</strong><p>El seguimiento requiere el backend.</p></div>
        <div><strong>Resultado simulado</strong><p>Sin compra ni acreditación.</p></div>
      </div>
      <Action disabled variant="outline">Pausar orden · no disponible</Action>
      <Action disabled variant="outline">Cancelar orden · no disponible</Action>
    </Shell>
  );
}

function OrdersScreen() {
  return (
    <Shell active="ordenes" title="Órdenes">
      <Intro eyebrow="Tu actividad" title="Tus recibos">Consultá tus órdenes y comprobantes en un solo lugar.</Intro>
      <Card className="empty-state"><p className="empty-title">Todavía no hay órdenes</p><p className="muted">El historial estará disponible cuando se conecte el backend.</p></Card>
      <Action href="/nueva-orden">Explorar nueva orden</Action>
      <Action href="/la-orden" variant="outline">Ver seguimiento de muestra</Action>
    </Shell>
  );
}

function AgentScreen() {
  return (
    <Shell active="agente" title="Copiloto">
      <Intro eyebrow="Solo lectura · sandbox" title={<>¿Qué está mirando<br />el agente ahora?</>}>Una vista de cómo se explicaría el estado de tus órdenes.</Intro>
      <Card><p className="label">Orden</p><p className="empty-title">Sin órdenes para mostrar</p><p className="muted">No hay seguimiento activo.</p></Card>
      <Card><p className="label">Qué evalúa el motor</p><p className="muted">Las condiciones se mostrarán al conectar el servicio de órdenes.</p></Card>
      <Card><p className="label">Próximo paso</p><p className="muted">Revisá las vistas de ejemplo mientras tanto.</p></Card>
      <Action href="/ordenes" variant="outline">Ir a órdenes</Action>
      <p className="footnote">El agente y las consultas todavía no están disponibles.</p>
    </Shell>
  );
}

export const screens: Record<string, ComponentType> = {
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
