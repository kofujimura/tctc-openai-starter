import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions, verifySessionToken } from "@/lib/session";

export async function GET(): Promise<NextResponse> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) {
      return NextResponse.json({ authenticated: false });
    }

    const address = await verifySessionToken(token);
    if (!address) {
      cookieStore.set(SESSION_COOKIE, "", {
        ...sessionCookieOptions(),
        expires: new Date(0),
      });
      return NextResponse.json({ authenticated: false });
    }

    return NextResponse.json({ authenticated: true, address });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to read session." },
      { status: 500 },
    );
  }
}
