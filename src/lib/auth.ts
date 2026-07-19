import { randomBytes } from "node:crypto";
import { SiweMessage } from "siwe";
import { getAddress, isAddress, type Address } from "viem";

const NONCE_BYTES = 16;
const MESSAGE_LIFETIME_MS = 5 * 60 * 1000;

export const SIGN_IN_STATEMENT =
  "Verify wallet ownership to use the token-gated OpenAI sample.";

export function createNonce(): string {
  return randomBytes(NONCE_BYTES).toString("hex");
}

export function createSignInMessage(input: {
  address: Address;
  chainId: number;
  domain: string;
  nonce: string;
  uri: string;
}): string {
  const issuedAt = new Date();
  return new SiweMessage({
    domain: input.domain,
    address: input.address,
    statement: SIGN_IN_STATEMENT,
    uri: input.uri,
    version: "1",
    chainId: input.chainId,
    nonce: input.nonce,
    issuedAt: issuedAt.toISOString(),
    expirationTime: new Date(issuedAt.getTime() + MESSAGE_LIFETIME_MS).toISOString(),
  }).prepareMessage();
}

export function assertAddress(value: unknown): Address {
  if (typeof value !== "string" || !isAddress(value)) {
    throw new Error("Invalid wallet address.");
  }
  return getAddress(value);
}

export async function verifySignInMessage(input: {
  message: string;
  signature: string;
  expectedChainId: number;
  expectedDomain: string;
  expectedNonce: string;
  expectedUri: string;
}): Promise<Address | null> {
  try {
    const message = new SiweMessage(input.message);
    if (
      message.chainId !== input.expectedChainId ||
      message.uri !== input.expectedUri ||
      message.statement !== SIGN_IN_STATEMENT
    ) {
      return null;
    }

    const result = await message.verify(
      {
        signature: input.signature,
        domain: input.expectedDomain,
        nonce: input.expectedNonce,
        time: new Date().toISOString(),
      },
      { suppressExceptions: true },
    );

    return result.success ? assertAddress(result.data.address) : null;
  } catch {
    return null;
  }
}
