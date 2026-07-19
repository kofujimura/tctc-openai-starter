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
  hasRole?: boolean;
  role?: string;
  subject?: string;
  evidence?: unknown[];
};

type McpToolResult = {
  content?: unknown;
};

let clientPromise: Promise<Client> | undefined;

async function getTctcClient(): Promise<Client> {
  if (!clientPromise) {
    clientPromise = (async () => {
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
        { name: "tctc-openai-token-gate", version: "0.1.0" },
        { capabilities: {} },
      );
      await client.connect(transport);
      return client;
    })().catch((error) => {
      clientPromise = undefined;
      throw error;
    });
  }
  return clientPromise;
}

export async function checkOpenAiCallerRole(subject: Address): Promise<CheckRolePayload> {
  const client = await getTctcClient();
  const result = await client.callTool({
    name: "check_role",
    arguments: {
      role: GATE_ROLE_NAME,
      subject: { address: subject },
    },
  });
  const content = (result as McpToolResult).content;
  if (!Array.isArray(content)) {
    throw new Error("tctc-mcp returned no content array.");
  }
  const text = content.find((item: unknown): item is McpTextContent => {
    return typeof item === "object" && item !== null && "type" in item && item.type === "text";
  });
  if (!text) {
    throw new Error("tctc-mcp returned no JSON text content.");
  }
  return JSON.parse(text.text) as CheckRolePayload;
}
