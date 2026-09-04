import { AgentPanel } from "@/components/agent-panel";
import { PrivateNavigation } from "@/components/private-navigation";
import { listFounderAgentsForPanel } from "@/lib/agents/repository";
import { founderSession } from "@/lib/auth/session";

export default async function PrivateLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await founderSession();
  if (session.state !== "authorized") return children;

  const agents = await listFounderAgentsForPanel(session.founder.id);

  return (
    <div className="private-app-shell">
      <PrivateNavigation />
      <div className="private-app-content">{children}</div>
      <AgentPanel agents={agents} />
    </div>
  );
}
