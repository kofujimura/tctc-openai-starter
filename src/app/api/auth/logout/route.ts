import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { NONCE_COOKIE, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

export async function POST(): Promise<NextResponse> {
  const cookieStore = await cookies();
  cookieStore.delete(NONCE_COOKIE);
  cookieStore.set(SESSION_COOKIE, "", {
    ...sessionCookieOptions(),
    expires: new Date(0),
  });
  return NextResponse.json({ disconnected: true });
}
