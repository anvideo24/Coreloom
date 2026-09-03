import "server-only";

import { createCoreloomAuth } from "@/lib/auth/server";
import { AuthenticatedUser, founderIdentityFromSession } from "@/lib/auth/founder";

export type FounderSession =
  | { state: "signed-out" }
  | { state: "denied" }
  | { state: "authorized"; founder: AuthenticatedUser };

export async function founderSession(): Promise<FounderSession> {
  const { data } = await createCoreloomAuth().getSession();
  if (!data?.user) return { state: "signed-out" };

  try {
    return {
      state: "authorized",
      founder: founderIdentityFromSession({ id: data.user.id, email: data.user.email }),
    };
  } catch {
    return { state: "denied" };
  }
}
