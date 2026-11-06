import Link from "next/link";

export default function Home() {
  return (
    <main className="shell">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Cauce, inicio">
          <span className="brand-mark" aria-hidden="true">c</span>
          <span>cauce</span>
        </Link>
        <span className="availability"><span aria-hidden="true" /> Demo disponible</span>
      </header>

      <section className="intro" aria-labelledby="welcome-title">
        <p className="eyebrow">Tu plata, en movimiento</p>
        <h1 id="welcome-title">A tu ritmo.<br /><span>A tu manera.</span></h1>
        <p className="intro-copy">Estamos preparando una forma más clara de mover y cuidar tu dinero.</p>
        <div className="status-card" role="status">
          <span className="status-icon" aria-hidden="true">✳</span>
          <div>
            <strong>La base de Cauce está lista</strong>
            <p>Este espacio ya está preparado para empezar a construir.</p>
          </div>
        </div>
      </section>

      <footer className="footer">
        <span>CAUCE · FINANZAS A TU RITMO</span>
        <span>Demo · 2026</span>
      </footer>
    </main>
  );
}
