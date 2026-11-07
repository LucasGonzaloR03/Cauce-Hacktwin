import { notFound } from "next/navigation";
import { screens } from "@/components/screens";

export function generateStaticParams() {
  return Object.keys(screens).map((screen) => ({ screen }));
}

export default async function ScreenPage({
  params,
}: {
  params: Promise<{ screen: string }>;
}) {
  const { screen } = await params;
  if (!Object.prototype.hasOwnProperty.call(screens, screen)) notFound();

  const Screen = screens[screen];
  return <Screen />;
}
