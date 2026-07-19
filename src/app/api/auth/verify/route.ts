import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifySignInMessage } from "@/lib/auth";
import { GATE_CHAIN_ID } from "@/lib/gate-config";
import {
  createSessionToken,
  NONCE_COOKIE,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/session";

type VerifyBody = {
  message?: unknown;
  signature?: unknown;
};

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as VerifyBody;
    const message = typeof body.message === "string" ? body.message : "";
    const signature = typeof body.signature === "string" ? body.signature : "";
    const cookieStore = await cookies();
    const nonce = cookieStore.get(NONCE_COOKIE)?.value;

    if (!nonce) {
      return NextResponse.json(
        { error: "The sign-in request is missing or expired. Please try again." },
        { status: 401 },
      );
    }

    const requestUrl = new URL(request.url);
    const address = await verifySignInMessage({
      message,
      signature,
      expectedChainId: GATE_CHAIN_ID,
      expectedDomain: requestUrl.host,
      expectedNonce: nonce,
      expectedUri: requestUrl.origin,
    });

    if (!address) {
      return NextResponse.json({ error: "Wallet signature verification failed." }, { status: 401 });
    }

    const sessionToken = await createSessionToken(address);
    cookieStore.set(SESSION_COOKIE, sessionToken, sessionCookieOptions());
    cookieStore.delete(NONCE_COOKIE);

    return NextResponse.json({ address });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Wallet verification failed." },
      { status: 500 },
    );
  }
}
