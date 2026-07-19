import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { checkOpenAiCallerRole, TctcServiceError } from "@/lib/tctc";

export const runtime = "nodejs";

type ChatBody = {
  prompt?: unknown;
};

function textFromResponse(data: unknown): string {
  if (typeof data === "object" && data !== null && "output_text" in data) {
    const value = (data as { output_text?: unknown }).output_text;
    if (typeof value === "string") return value;
  }
  return JSON.stringify(data, null, 2);
}

async function callOpenAi(prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      input: prompt,
    }),
  });

  const data = (await response.json()) as unknown;
  if (!response.ok) {
    const message =
      typeof data === "object" && data !== null && "error" in data
        ? JSON.stringify((data as { error: unknown }).error)
        : response.statusText;
    throw new Error(`OpenAI API request failed: ${message}`);
  }

  return textFromResponse(data);
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as ChatBody;
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;
    const address = sessionToken ? await verifySessionToken(sessionToken) : null;

    if (!address) {
      return NextResponse.json(
        { error: "Verify wallet ownership before sending a prompt." },
        { status: 401 },
      );
    }
    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
    }

    // Authorization is intentionally re-evaluated on every protected request.
    const role = await checkOpenAiCallerRole(address);
    if (!role.hasRole) {
      return NextResponse.json(
        {
          error: "This wallet does not hold the token required by the gate policy.",
          role,
        },
        { status: 403 },
      );
    }

    const output = await callOpenAi(prompt);
    return NextResponse.json({ output, role });
  } catch (error) {
    if (error instanceof TctcServiceError) {
      return NextResponse.json(
        { error: error.message },
        {
          status: error.statusCode,
          headers: error.statusCode === 503 ? { "Retry-After": "2" } : undefined,
        },
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Request failed." },
      { status: 500 },
    );
  }
}
