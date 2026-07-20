import { jwtVerify, SignJWT } from "jose";
import { assertAddress } from "@/lib/auth";
import type { Address } from "viem";

const SESSION_ISSUER = "tctc-openai-starter";
const SESSION_AUDIENCE = "tctc-openai-starter-web";
const SESSION_LIFETIME = "8h";

export const NONCE_COOKIE = "tctc_nonce";
export const SESSION_COOKIE =
  process.env.NODE_ENV === "production" ? "__Host-tctc_session" : "tctc_session";

function sessionKey(): Uint8Array {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters.");
  }
  return new TextEncoder().encode(value);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

export async function createSessionToken(address: Address): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(address)
    .setIssuer(SESSION_ISSUER)
    .setAudience(SESSION_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(SESSION_LIFETIME)
    .sign(sessionKey());
}

export async function verifySessionToken(token: string): Promise<Address | null> {
  const key = sessionKey();
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ["HS256"],
      issuer: SESSION_ISSUER,
      audience: SESSION_AUDIENCE,
    });
    return assertAddress(payload.sub);
  } catch {
    return null;
  }
}
