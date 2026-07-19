"use client";

import {
  Bot,
  Check,
  Circle,
  Code2,
  ExternalLink,
  KeyRound,
  LoaderCircle,
  LogOut,
  Send,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { PublicGateConfig } from "@/lib/gate-config";

type EthereumProvider = {
  request<T = unknown>(args: { method: string; params?: unknown[] }): Promise<T>;
  on?(event: "accountsChanged" | "chainChanged", listener: (value: unknown) => void): void;
  removeListener?(
    event: "accountsChanged" | "chainChanged",
    listener: (value: unknown) => void,
  ): void;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

type ChatResponse = {
  output?: string;
  error?: string;
};

type SessionResponse = {
  authenticated?: boolean;
  address?: string;
  error?: string;
};

type Status = {
  tone: "neutral" | "success" | "error";
  text: string;
};

class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function responseJson<T extends { error?: string }>(response: Response): Promise<T> {
  const data = (await response.json()) as T;
  if (!response.ok) {
    throw new ApiError(data.error ?? "Request failed.", response.status);
  }
  return data;
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function TokenGateApp({ config }: { config: PublicGateConfig }) {
  const [walletAddress, setWalletAddress] = useState("");
  const [verifiedAddress, setVerifiedAddress] = useState("");
  const [prompt, setPrompt] = useState("Explain token gating in three concise sentences.");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState<"connect" | "verify" | "send" | "disconnect" | "">("");
  const [status, setStatus] = useState<Status>({
    tone: "neutral",
    text: "Connect a wallet to begin.",
  });

  const verified = useMemo(
    () =>
      Boolean(
        walletAddress &&
          verifiedAddress &&
          walletAddress.toLowerCase() === verifiedAddress.toLowerCase(),
      ),
    [verifiedAddress, walletAddress],
  );

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      try {
        const ethereum = window.ethereum;
        const [sessionResponse, accounts] = await Promise.all([
          fetch("/api/auth/session", { cache: "no-store" }),
          ethereum
            ? ethereum.request<string[]>({ method: "eth_accounts" }).catch(() => [])
            : Promise.resolve([]),
        ]);
        const session = await responseJson<SessionResponse>(sessionResponse);
        if (!active) return;

        const wallet = accounts[0] ?? "";
        if (session.authenticated && session.address) {
          if (wallet && wallet.toLowerCase() !== session.address.toLowerCase()) {
            await fetch("/api/auth/logout", { method: "POST" });
            setWalletAddress(wallet);
            setStatus({ tone: "neutral", text: "Wallet changed. Verify the new address." });
            return;
          }
          setWalletAddress(wallet || session.address);
          setVerifiedAddress(session.address);
          setStatus({ tone: "success", text: "Token gate session restored." });
          return;
        }

        if (wallet) {
          setWalletAddress(wallet);
          setStatus({ tone: "neutral", text: "Wallet connected. Verify ownership once." });
        }
      } catch (error) {
        if (!active) return;
        setStatus({
          tone: "error",
          text: error instanceof Error ? error.message : "Failed to restore the session.",
        });
      }
    }

    void restoreSession();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const ethereum = window.ethereum;
    if (!ethereum?.on) return;

    const resetSession = (text: string, nextAddress?: string) => {
      void fetch("/api/auth/logout", { method: "POST" });
      setVerifiedAddress("");
      setResult("");
      if (nextAddress !== undefined) setWalletAddress(nextAddress);
      setStatus({ tone: "neutral", text });
    };
    const handleAccountsChanged = (value: unknown) => {
      const accounts = Array.isArray(value) ? value : [];
      const address = typeof accounts[0] === "string" ? accounts[0] : "";
      resetSession(
        address ? "Wallet changed. Verify the new address." : "Wallet disconnected.",
        address,
      );
    };
    const handleChainChanged = () => {
      resetSession("Network changed. Verify wallet ownership again.");
    };

    ethereum.on("accountsChanged", handleAccountsChanged);
    ethereum.on("chainChanged", handleChainChanged);
    return () => {
      ethereum.removeListener?.("accountsChanged", handleAccountsChanged);
      ethereum.removeListener?.("chainChanged", handleChainChanged);
    };
  }, []);

  async function connectWallet() {
    if (!window.ethereum) {
      setStatus({ tone: "error", text: "No injected Ethereum wallet was found." });
      return;
    }
    setBusy("connect");
    try {
      const accounts = await window.ethereum.request<string[]>({ method: "eth_requestAccounts" });
      const address = accounts[0] ?? "";
      setWalletAddress(address);
      setVerifiedAddress("");
      setResult("");
      setStatus({
        tone: address ? "neutral" : "error",
        text: address ? "Wallet connected. Verify ownership once." : "No account selected.",
      });
    } catch (error) {
      setStatus({
        tone: "error",
        text: error instanceof Error ? error.message : "Wallet connection failed.",
      });
    } finally {
      setBusy("");
    }
  }

  async function verifyWallet() {
    if (!window.ethereum || !walletAddress) return;
    setBusy("verify");
    setStatus({ tone: "neutral", text: "Waiting for your wallet signature..." });
    try {
      const nonceResponse = await fetch("/api/auth/nonce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: walletAddress }),
      });
      const nonceData = await responseJson<{ message?: string; error?: string }>(nonceResponse);
      if (!nonceData.message) throw new Error("The server returned no sign-in message.");

      const signature = await window.ethereum.request<string>({
        method: "personal_sign",
        params: [nonceData.message, walletAddress],
      });
      const verifyResponse = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: nonceData.message, signature }),
      });
      const session = await responseJson<{ address?: string; error?: string }>(verifyResponse);
      if (!session.address) throw new Error("The server returned no verified address.");

      setVerifiedAddress(session.address);
      setStatus({ tone: "success", text: "Wallet verified. Token gate session is active." });
    } catch (error) {
      setStatus({
        tone: "error",
        text: error instanceof Error ? error.message : "Wallet verification failed.",
      });
    } finally {
      setBusy("");
    }
  }

  async function disconnectGate() {
    setBusy("disconnect");
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setWalletAddress("");
      setVerifiedAddress("");
      setResult("");
      setBusy("");
      setStatus({ tone: "neutral", text: "Token gate disconnected." });
    }
  }

  async function sendPrompt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!verified || !prompt.trim()) return;
    setBusy("send");
    setResult("");
    setStatus({ tone: "neutral", text: "Checking the on-chain gate policy..." });
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await responseJson<ChatResponse>(response);
      setResult(data.output ?? "");
      setStatus({ tone: "success", text: "Access granted. OpenAI response received." });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setVerifiedAddress("");
      }
      setStatus({
        tone: "error",
        text: error instanceof Error ? error.message : "Request failed.",
      });
    } finally {
      setBusy("");
    }
  }

  const standard = config.standard.replace(/^erc/i, "ERC-");
  const tokenLabel = config.tokenId === undefined ? standard : `${standard} #${config.tokenId}`;
  const chainLabel = `${config.chain.charAt(0).toUpperCase()}${config.chain.slice(1)}`;

  return (
    <>
      <header className="topbar">
        <a className="brand" href="/" aria-label="tctc OpenAI Token Gate home">
          <span className="brand-mark"><ShieldCheck size={19} aria-hidden="true" /></span>
          <span>tctc / OpenAI Token Gate</span>
        </a>
        <a
          className="repo-link"
          href="https://github.com/kofujimura/tctc-openai-token-gate"
          target="_blank"
          rel="noreferrer"
        >
          <Code2 size={17} aria-hidden="true" />
          GitHub
        </a>
      </header>

      <main className="app-shell">
        <section className="page-heading">
          <p className="eyebrow">ON-CHAIN ACCESS CONTROL</p>
          <h1>Token-gated OpenAI</h1>
          <p>Wallet ownership establishes your identity. tctc-mcp checks access on-chain for every request.</p>
        </section>

        <section className="flow" aria-label="Connection progress">
          <div className={`flow-step ${walletAddress ? "complete" : "active"}`}>
            <span className="step-icon">
              {walletAddress ? <Check size={16} aria-hidden="true" /> : <Wallet size={16} aria-hidden="true" />}
            </span>
            <span><strong>Connect</strong><small>Wallet</small></span>
          </div>
          <span className="flow-line" aria-hidden="true" />
          <div className={`flow-step ${verified ? "complete" : walletAddress ? "active" : ""}`}>
            <span className="step-icon">
              {verified ? <Check size={16} aria-hidden="true" /> : <KeyRound size={16} aria-hidden="true" />}
            </span>
            <span><strong>Verify</strong><small>Ownership</small></span>
          </div>
          <span className="flow-line" aria-hidden="true" />
          <div className={`flow-step ${verified ? "active" : ""}`}>
            <span className="step-icon"><Bot size={16} aria-hidden="true" /></span>
            <span><strong>Ask</strong><small>OpenAI</small></span>
          </div>
        </section>

        <section className="workspace">
          <aside className="gate-summary">
            <div className="summary-heading">
              <ShieldCheck size={20} aria-hidden="true" />
              <div>
                <h2>Access requirement</h2>
                <p>Current gate policy</p>
              </div>
            </div>
            <dl>
              <div><dt>Network</dt><dd>{chainLabel} <span>#{config.chainId}</span></dd></div>
              <div><dt>Role</dt><dd>{config.role}</dd></div>
              <div><dt>Token</dt><dd>{tokenLabel}</dd></div>
              <div>
                <dt>Contract</dt>
                <dd>
                  <a
                    href={`https://sepolia.etherscan.io/address/${config.contractAddress}`}
                    target="_blank"
                    rel="noreferrer"
                    title={config.contractAddress}
                  >
                    {shortAddress(config.contractAddress)}
                    <ExternalLink size={13} aria-hidden="true" />
                  </a>
                </dd>
              </div>
              <div><dt>Model</dt><dd>{config.model}</dd></div>
            </dl>
            <p className="policy-note">Token ownership is checked again each time you ask OpenAI.</p>
          </aside>

          <div className="prompt-workspace">
            <div className="connection-row">
              <div className="identity">
                <span className={`identity-indicator ${verified ? "verified" : ""}`} aria-hidden="true">
                  {verified ? <Check size={14} /> : <Circle size={12} />}
                </span>
                <div>
                  <span className="identity-label">{verified ? "Wallet verified" : "Wallet status"}</span>
                  <strong>{walletAddress ? shortAddress(walletAddress) : "Not connected"}</strong>
                </div>
              </div>

              {!walletAddress ? (
                <button className="button primary" type="button" onClick={connectWallet} disabled={Boolean(busy)}>
                  {busy === "connect" ? <LoaderCircle className="spin" size={17} /> : <Wallet size={17} />}
                  Connect wallet
                </button>
              ) : !verified ? (
                <button className="button primary" type="button" onClick={verifyWallet} disabled={Boolean(busy)}>
                  {busy === "verify" ? <LoaderCircle className="spin" size={17} /> : <KeyRound size={17} />}
                  Verify wallet ownership
                </button>
              ) : (
                <button className="button secondary" type="button" onClick={disconnectGate} disabled={Boolean(busy)}>
                  {busy === "disconnect" ? <LoaderCircle className="spin" size={17} /> : <LogOut size={17} />}
                  Disconnect token gate
                </button>
              )}
            </div>

            {!verified && walletAddress ? (
              <p className="signature-note">
                Signing proves that you control this wallet. It does not send a transaction or cost gas.
              </p>
            ) : null}

            <div className={`notice ${status.tone}`} role="status" aria-live="polite">
              {status.tone === "success" ? <Check size={15} aria-hidden="true" /> : <Circle size={10} aria-hidden="true" />}
              <span>{status.text}</span>
            </div>

            <form onSubmit={sendPrompt}>
              <div className="field-heading">
                <label htmlFor="prompt">Prompt</label>
                <span>Protected request</span>
              </div>
              <textarea
                id="prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                disabled={busy === "send"}
                placeholder="Ask OpenAI..."
                maxLength={4000}
              />
              <div className="form-footer">
                <span>{prompt.length} / 4000</span>
                <button className="button primary" type="submit" disabled={!verified || !prompt.trim() || Boolean(busy)}>
                  {busy === "send" ? <LoaderCircle className="spin" size={17} /> : <Send size={17} />}
                  Ask OpenAI
                </button>
              </div>
            </form>

            <section className="response-area" aria-labelledby="response-heading">
              <div className="response-heading">
                <h2 id="response-heading">Response</h2>
                {result ? <span>Gate passed</span> : null}
              </div>
              <div className={`response-content ${result ? "has-result" : ""}`}>
                {result || "The response will appear here after the gate grants access."}
              </div>
            </section>
          </div>
        </section>
      </main>
    </>
  );
}
