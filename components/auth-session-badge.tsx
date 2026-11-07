"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, Stamp } from "@/components/ui";
import { useDemoBalance } from "@/app/providers";

type Profile = { linked: boolean; email: string | null; demo: true };
const profileKey = ["auth-profile"] as const;

export function AuthSessionBadge() {
  const { balance } = useDemoBalance();
  const profile = useQuery<Profile>({
    queryKey: profileKey,
    queryFn: async () => {
      const response = await fetch("/api/auth/me", { cache: "no-store" });
      if (!response.ok) throw new Error("No se pudo consultar la cuenta.");
      return response.json();
    },
    retry: false,
    enabled: Boolean(balance),
  });

  if (profile.isPending) return null;
  return <Card className="horizontal auth-session-badge">
    <div>
      <p className="label">Sesión activa</p>
      <strong>{profile.data?.linked ? profile.data.email : "Demo anónima"}</strong>
    </div>
    <Stamp>{profile.data?.linked ? "Cuenta" : "Demo"}</Stamp>
  </Card>;
}
