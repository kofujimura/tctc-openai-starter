import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { GATE_ROLE_NAME } from "@/lib/gate-config";
import type { Address } from "viem";

const TCTC_CONFIG = path.join(process.cwd(), "config", "tctc.config.json");
const TCTC_BIN = path.join(process.cwd(), "node_modules", ".bin", "tctc-mcp");

type McpTextContent = {
  type: "text";
  text: string;
};

type CheckRolePayload = {
  hasRole: boolean;
  role?: string;
  subject?: string;
  evidence?: unknown[];
};

type McpToolResult = {
  content?: unknown;
  isError?: boolean;
};

export class TctcServiceError extends Error {
  constructor(
    message: string,
    readonly statusCode: 502 | 503,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "TctcServiceError";
  }
}

let clientPromise: Promise<Client> | undefined;
let activeClient: Client | undefined;
let activeClientPromise: Promise<Client> | undefined;

function resetClient(expectedPromise: Promise<Client>, expectedClient?: Client): void {
  if (clientPromise === expectedPromise || (expectedClient && activeClient === expectedClient)) {
    clientPromise = undefined;
    activeClient = undefined;
    activeClientPromise = undefined;
  }
}

async function getTctcClient(): Promise<Client> {
  if (!clientPromise) {
    let pending!: Promise<Client>;
    pending = (async () => {
      if (!process.env.SEPOLIA_RPC_URL) {
        throw new Error("SEPOLIA_RPC_URL is not configured.");
      }
      const transport = new StdioClientTransport({
        command: TCTC_BIN,
        args: ["--config", TCTC_CONFIG],
        env: {
          PATH: process.env.PATH ?? "",
          HOME: process.env.HOME ?? "",
          SEPOLIA_RPC_URL: process.env.SEPOLIA_RPC_URL ?? "",
        },
      });
      const client = new Client(
        { name: "tctc-openai-starter", version: "0.1.0" },
        { capabilities: {} },
      );

      // The SDK preserves a pre-connect transport callback and invokes it on child exit.
      transport.onclose = () => resetClient(pending, client);
      await client.connect(transport);
      if (clientPromise === pending) {
        activeClient = client;
        activeClientPromise = pending;
      }
      return client;
    })().catch((error: unknown) => {
      resetClient(pending);
      throw new TctcServiceError(
        "The token gate service is temporarily unavailable.",
        503,
        { cause: error },
      );
    });
    clientPromise = pending;
  }
  return clientPromise;
}

function firstTextContent(content: unknown): McpTextContent | undefined {
  if (!Array.isArray(content)) return undefined;
  return content.find((item: unknown): item is McpTextContent => {
    return (
      typeof item === "object" &&
      item !== null &&
      "type" in item &&
      item.type === "text" &&
      "text" in item &&
      typeof item.text === "string"
    );
  });
}

function parseCheckRolePayload(text: string): CheckRolePayload {
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch (error) {
    throw new TctcServiceError("The token gate service returned an invalid response.", 502, {
      cause: error,
    });
  }

  if (
    typeof payload !== "object" ||
    payload === null ||
    !("hasRole" in payload) ||
    typeof payload.hasRole !== "boolean"
  ) {
    throw new TctcServiceError("The token gate service returned an invalid response.", 502);
  }
  return payload as CheckRolePayload;
}

function toolErrorCode(text: string | undefined): string {
  if (!text) return "UNKNOWN";
  try {
    const payload = JSON.parse(text) as { error?: unknown };
    return typeof payload.error === "string" ? payload.error : "UNKNOWN";
  } catch {
    return "UNKNOWN";
  }
}

export async function checkOpenAiCallerRole(subject: Address): Promise<CheckRolePayload> {
  const client = await getTctcClient();
  let result: McpToolResult;
  try {
    result = (await client.callTool({
      name: "check_role",
      arguments: {
        role: GATE_ROLE_NAME,
        subject: { address: subject },
      },
    })) as McpToolResult;
  } catch (error) {
    const failedPromise = activeClient === client ? activeClientPromise : undefined;
    if (failedPromise) resetClient(failedPromise, client);
    try {
      await client.close();
    } catch {
      // The connection may already be closed.
    }
    throw new TctcServiceError(
      "The token gate service is temporarily unavailable.",
      503,
      { cause: error },
    );
  }

  const text = firstTextContent(result.content);
  if (result.isError) {
    console.error("tctc-mcp check_role failed with code:", toolErrorCode(text?.text));
    throw new TctcServiceError("The token gate service is temporarily unavailable.", 503);
  }
  if (!text) {
    throw new TctcServiceError("The token gate service returned an invalid response.", 502);
  }
  return parseCheckRolePayload(text.text);
}
