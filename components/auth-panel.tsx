"use client";

import { useSyncExternalStore, useState } from "react";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Card, Stamp } from "@/components/ui";
import { useDemoBalance } from "@/app/providers";

type Profile = { linked: boolean; email: string | null; demo: true };
const profileKey = ["auth-profile"] as const;

function subscribeHash(callback: () => void) {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}
function getHashToken() { return new URLSearchParams(window.location.hash.slice(1)).get("token"); }
function getServerHashToken() { return null; }

async function postJson(path: string, body?: unknown) {
  const response = await fetch(path, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}), cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail ?? "No se pudo completar la operación.");
  return data;
}

export function AuthPanel() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { balance, balanceError } = useDemoBalance();
  const sessionReady = Boolean(balance);
  const profileQuery = useQuery<Profile>({
    queryKey: profileKey,
    queryFn: async () => {
      const response = await fetch("/api/auth/me", { cache: "no-store" });
      if (!response.ok) throw new Error("No se pudo leer la sesión.");
      return response.json();
    },
    retry: false,
    enabled: sessionReady,
  });
  const profile = profileQuery.data ?? null;
  const [email, setEmail] = useState("");
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const linkToken = useSyncExternalStore(subscribeHash, getHashToken, getServerHashToken);

  async function refreshProfile() {
    const response = await fetch("/api/auth/me", { cache: "no-store" });
    if (!response.ok) throw new Error("No se pudo leer la sesión.");
    queryClient.setQueryData<Profile>(profileKey, await response.json());
    await queryClient.invalidateQueries();
  }

  async function completeSignIn(message: string) {
    await refreshProfile();
    setShowAccountForm(false);
    router.replace("/inicio");
    router.refresh();
    setStatus(message);
  }

  async function run(action: () => Promise<void>) {
    setBusy(true); setStatus("");
    try { await action(); } catch (error) { setStatus(error instanceof Error ? error.message : "Ocurrió un error."); }
    finally { setBusy(false); }
  }

  return <section className="auth-panel" aria-label="Cuenta y acceso">
    <h2>Tu cuenta</h2>
    <p className="muted">{profile?.linked ? "Tu cuenta está activa. Podés cambiar a otra cuenta o cerrar esta sesión." : "La demo sigue abierta sin registro. Con un email podés vincular esta sesión o entrar a una cuenta que ya usaste."}</p>
    <Card className="login-identity">
      <span className="login-avatar" aria-hidden="true">{profile?.linked ? profile.email?.[0]?.toUpperCase() ?? "U" : "D"}</span>
      <div className="login-user">
      <strong>{!sessionReady || profileQuery.isPending ? "Preparando sesión…" : profile?.linked ? "Cuenta con email" : "Sesión de demo"}</strong>
        <span>{profile?.linked ? profile.email : "Acceso anónimo · datos de demo"}</span>
      </div>
      <Stamp>{profile?.linked ? "Cuenta" : "Demo"}</Stamp>
    </Card>
    {balanceError && <p className="auth-message" role="alert">No se pudo preparar la sesión. Recargá la página antes de iniciar.</p>}
    {(!profile?.linked || showAccountForm) && <form onSubmit={(event) => {
      event.preventDefault();
      void run(async () => {
        const result = await postJson("/api/auth/email/start", { email });
        if (result.mode === "sandbox") {
          setPreviewUrl(result.previewUrl);
          setStatus("Abrí el enlace de prueba y confirmá para continuar.");
        } else {
          setPreviewUrl(null);
          setStatus("Te enviamos un enlace. Abrilo para entrar o vincular tu cuenta.");
        }
      });
    }}>
      <label htmlFor="auth-email">{profile?.linked ? "Email de la otra cuenta" : "Email"}</label>
      <input id="auth-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="vos@ejemplo.com" />
      <button className="button" disabled={busy || !sessionReady || profileQuery.isPending}>{busy ? "Procesando…" : "Enviar enlace de acceso"}</button>
    </form>}
    {profile?.linked && !showAccountForm && <div className="auth-actions">
      <button className="button button-outline" type="button" disabled={busy} onClick={() => { setShowAccountForm(true); setStatus(""); }}>Cambiar de cuenta</button>
      <button className="button button-outline" type="button" disabled={busy} onClick={() => void run(async () => {
        await postJson("/api/auth/logout");
        queryClient.setQueryData<Profile>(profileKey, { linked: false, email: null, demo: true });
        await queryClient.invalidateQueries();
        router.replace("/acceso");
        router.refresh();
      })}>{busy ? "Cerrando sesión…" : "Cerrar sesión"}</button>
    </div>}
    {profile?.linked && showAccountForm && <button className="button button-outline" type="button" disabled={busy} onClick={() => setShowAccountForm(false)}>Cancelar cambio de cuenta</button>}
    {previewUrl && <a className="auth-preview" href={previewUrl}>Abrir enlace sandbox</a>}
    {linkToken && <button className="button button-outline" disabled={busy || !sessionReady} onClick={() => void run(async () => {
      const result = await postJson("/api/auth/email/verify", { token: linkToken });
      history.replaceState(null, "", window.location.pathname);
      await completeSignIn(result.intent === "login" ? "Iniciaste sesión; cargamos los datos de esa cuenta." : "Email verificado; esta sesión quedó vinculada.");
    })}>{busy ? "Confirmando…" : "Confirmar acceso y cargar cuenta"}</button>}
    <div className="auth-actions">
      {(!profile?.linked || showAccountForm) && <button className="button button-outline" type="button" disabled={busy || !sessionReady} onClick={() => void run(async () => {
        const options = await postJson("/api/auth/passkeys/authentication/options");
        const response = await startAuthentication({ optionsJSON: options });
        await postJson("/api/auth/passkeys/authentication/verify", { response });
        await completeSignIn("Iniciaste sesión con passkey; cargamos los datos de esa cuenta.");
      })}>Entrar con passkey</button>}
      {profile?.linked && <button className="button button-outline" type="button" disabled={busy} onClick={() => void run(async () => {
        const options = await postJson("/api/auth/passkeys/register/options");
        const response = await startRegistration({ optionsJSON: options });
        await postJson("/api/auth/passkeys/register/verify", { response });
        setStatus("Passkey guardada en este dispositivo.");
      })}>Configurar Face ID / huella</button>}
    </div>
    {status && <p className="auth-message" role="status">{status}</p>}
    <p className="footnote">Las operaciones y el saldo siguen siendo de demostración; no se reciben ni mueven fondos reales.</p>
  </section>;
}
