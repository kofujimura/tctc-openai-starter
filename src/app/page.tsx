import TokenGateApp from "@/components/token-gate-app";
import { getPublicGateConfig } from "@/lib/gate-config";

export const dynamic = "force-dynamic";

export default function Home() {
  return <TokenGateApp config={getPublicGateConfig()} />;
}
