import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { assertAddress, createNonce, createSignInMessage } from "@/lib/auth";
import { GATE_CHAIN_ID } from "@/lib/gate-config";
import { NONCE_COOKIE, sessionCookieOptions } from "@/lib/session";

const NONCE_LIFETIME_SECONDS = 5 * 60;

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as { address?: unknown };
    const address = assertAddress(body.address);
    const nonce = createNonce();
    const requestUrl = new URL(request.url);
    const message = createSignInMessage({
      address,
      chainId: GATE_CHAIN_ID,
      domain: requestUrl.host,
      nonce,
      uri: requestUrl.origin,
    });
    const cookieStore = await cookies();

    cookieStore.set(NONCE_COOKIE, nonce, {
      ...sessionCookieOptions(),
      maxAge: NONCE_LIFETIME_SECONDS,
    });

    return NextResponse.json({ message });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create sign-in message." },
      { status: 400 },
    );
  }
}
