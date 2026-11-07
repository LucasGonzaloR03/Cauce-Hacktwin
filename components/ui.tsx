import Link from "next/link";
import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function Action({
  children,
  href,
  variant = "primary",
  disabled = false,
  onClick,
}: {
  children: ReactNode;
  href?: string;
  variant?: "primary" | "outline";
  disabled?: boolean;
  onClick?: () => void;
}) {
  const className = `action action--${variant}`;
  if (href && !disabled) {
    return <Link className={className} href={href}>{children}</Link>;
  }
  return <button className={className} type="button" disabled={disabled} onClick={onClick}>{children}</button>;
}

export function QuickAction({
  icon,
  title,
  description,
  href,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link className="quick-action" href={href}>
      <span className="quick-icon" aria-hidden="true">{icon}</span>
      <strong>{title}</strong>
      <span>{description}</span>
    </Link>
  );
}

export function Row({ label, value }: { label: string; value: ReactNode }) {
  return <div className="row"><span>{label}</span><strong>{value}</strong></div>;
}

export function Stamp({ children }: { children: ReactNode }) {
  return <span className="stamp">{children}</span>;
}

export function Header({ title, back }: { title?: string; back?: string }) {
  return (
    <header className="topbar">
      {back ? (
        <Link className="back" href={back} aria-label="Volver">←</Link>
      ) : (
        <Link className="wordmark" href="/inicio">Cauce</Link>
      )}
      {title && <span className="label">{title}</span>}
      <span className="pill">Demo</span>
    </header>
  );
}

const navigation = [
  { label: "Home", href: "/inicio", id: "home" },
  { label: "Transferir", href: "/transferir", id: "transferir" },
  { label: "Órdenes", href: "/ordenes", id: "ordenes" },
  { label: "Agente", href: "/agente", id: "agente" },
];

export function Shell({
  children,
  active,
  title,
  back,
}: {
  children: ReactNode;
  active?: string;
  title?: string;
  back?: string;
}) {
  return (
    <div className="app-shell">
      <main className="content">
        <Header title={title} back={back} />
        {children}
      </main>
      <nav className="nav" aria-label="Navegación principal">
        {navigation.map((item) => (
          <Link
            key={item.id}
            className={active === item.id ? "active" : ""}
            href={item.href}
            aria-current={active === item.id ? "page" : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
