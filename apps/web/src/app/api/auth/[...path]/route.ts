import { createCoreloomAuth } from "@/lib/auth/server";

export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) {
  return createCoreloomAuth().handler().GET(request, context);
}

export async function POST(request: Request, context: { params: Promise<{ path: string[] }> }) {
  return createCoreloomAuth().handler().POST(request, context);
}
