import { PrivateNavigation } from "@/components/private-navigation";
import { founderSession } from "@/lib/auth/session";

export default async function PrivateLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await founderSession();
  if (session.state !== "authorized") return children;

  return <div className="private-app-shell"><PrivateNavigation /><div className="private-app-content">{children}</div></div>;
}
