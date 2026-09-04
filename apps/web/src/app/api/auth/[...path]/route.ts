import { createCoreloomAuth } from "@/lib/auth/server";
import { authRequestForUpstream } from "@/lib/auth/funnel-origin";

export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) {
  return createCoreloomAuth().handler().GET(authRequestForUpstream(request), context);
}

export async function POST(request: Request, context: { params: Promise<{ path: string[] }> }) {
  return createCoreloomAuth().handler().POST(authRequestForUpstream(request), context);
}
