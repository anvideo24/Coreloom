import type { NextRequest } from "next/server";

import { createCoreloomAuth } from "@/lib/auth/server";

export default async function proxy(request: NextRequest) {
  return createCoreloomAuth().middleware({ loginUrl: "/sign-in" })(request);
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
