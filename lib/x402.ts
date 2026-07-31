// ProsPilot x402 paywall helpers (Pharos Pacific mainnet, chain 1672).
// External agents pay USDC per call; same-origin web chat stays free.

import { NextRequest, NextResponse } from "next/server";
import { withX402, x402ResourceServer } from "@x402/next";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";

export const PHAROS_CAIP2 = "eip155:1672" as const;
export const PHAROS_USDC = "0xc879c018db60520f4355c26ed1a6d572cdac1815" as const;

/** Default receiver — override with PAY_TO_ADDRESS / X402_PAY_TO */
export const DEFAULT_PAY_TO =
  "0xf33513B9702669898A2DA2166256f88D400d88D8" as const;

const ALLOWED_BROWSER_ORIGINS = [
  "https://pharos-agent-pi.vercel.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

export type PaidRouteConfig = {
  price: string;
  description: string;
};

export function getPayToAddress(): `0x${string}` {
  const raw =
    process.env.X402_PAY_TO?.trim() ||
    process.env.PAY_TO_ADDRESS?.trim() ||
    DEFAULT_PAY_TO;
  return raw as `0x${string}`;
}

export function getFacilitatorUrl(): string | null {
  const url =
    process.env.X402_FACILITATOR_URL?.trim() ||
    process.env.FACILITATOR_URL?.trim() ||
    "";
  return url || null;
}

/** True when paywall is armed (env flag + facilitator reachable). */
export function isX402Enabled(): boolean {
  const flag = (process.env.X402_ENABLED ?? "").toLowerCase();
  if (flag !== "1" && flag !== "true" && flag !== "yes") return false;
  return Boolean(getFacilitatorUrl());
}

export function x402PublicStatus() {
  const enabled = isX402Enabled();
  return {
    protocol: "x402",
    supported: true,
    enabled,
    network: PHAROS_CAIP2,
    chainId: 1672,
    asset: PHAROS_USDC,
    assetSymbol: "USDC",
    payTo: getPayToAddress(),
    facilitatorConfigured: Boolean(getFacilitatorUrl()),
    freeFor: ["same-origin ProsPilot web chat", "GET /api/health", "GET /api/info"],
    note: enabled
      ? "Premium skill APIs require x402 USDC payment from external agents."
      : "x402 code is live; set X402_ENABLED=true and X402_FACILITATOR_URL to enforce payment.",
  };
}

let cachedServer: x402ResourceServer | null = null;

export function getX402ResourceServer(): x402ResourceServer | null {
  const facilitatorUrl = getFacilitatorUrl();
  if (!facilitatorUrl) return null;
  if (cachedServer) return cachedServer;

  const facilitatorClient = new HTTPFacilitatorClient({ url: facilitatorUrl });
  const resourceServer = new x402ResourceServer(facilitatorClient);
  const evmScheme = new ExactEvmScheme();
  const usdc = (process.env.USDC_ADDRESS?.trim() || PHAROS_USDC) as `0x${string}`;

  evmScheme.registerMoneyParser(async (amount: number, network: string) => {
    if (network !== PHAROS_CAIP2) return null;
    return {
      amount: Math.round(amount * 1e6).toString(),
      asset: usdc,
      extra: {
        token: "USDC",
        name: "USDC",
        version: "2",
      },
    };
  });

  resourceServer.register(PHAROS_CAIP2, evmScheme);
  cachedServer = resourceServer;
  return cachedServer;
}

function headerHost(value: string): string {
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return "";
  }
}

/** Browser chat / same site — never charge the human UI. */
export function isSameOriginBrowser(req: Request): boolean {
  const origin = req.headers.get("origin") ?? "";
  const referer = req.headers.get("referer") ?? "";
  const host = (req.headers.get("host") ?? "").toLowerCase();

  for (const allowed of ALLOWED_BROWSER_ORIGINS) {
    if (origin === allowed || referer.startsWith(allowed)) return true;
  }

  const originHost = headerHost(origin);
  const refererHost = headerHost(referer);
  if (host && (originHost === host || refererHost === host)) return true;

  const bypass = process.env.X402_BYPASS_SECRET?.trim();
  if (bypass && req.headers.get("x-prospilot-bypass") === bypass) return true;

  return false;
}

type RouteHandler = (req: NextRequest) => Promise<Response> | Response;

/**
 * Wrap a skill API handler with x402 when enabled.
 * Same-origin web chat and disabled mode stay free.
 */
export function withPaidSkill(
  handler: RouteHandler,
  config: PaidRouteConfig,
): (req: NextRequest) => Promise<Response> {
  return async (req: NextRequest) => {
    if (!isX402Enabled() || isSameOriginBrowser(req)) {
      return handler(req);
    }

    const server = getX402ResourceServer();
    if (!server) {
      return handler(req);
    }

    const paid = withX402(
      async (r: NextRequest) => {
        const res = await handler(r);
        if (res instanceof NextResponse) return res;
        const body = await res.arrayBuffer();
        return new NextResponse(body, {
          status: res.status,
          statusText: res.statusText,
          headers: res.headers,
        });
      },
      {
        accepts: {
          scheme: "exact",
          price: config.price,
          network: PHAROS_CAIP2,
          payTo: getPayToAddress(),
        },
        description: config.description,
        mimeType: "application/json",
      },
      server,
      undefined,
      undefined,
      false,
    );

    return paid(req);
  };
}

/** Suggested prices for premium ProsPilot skill APIs (USD → USDC). */
export const X402_SKILL_PRICES = {
  sybilCheck: { price: "$0.01", description: "ProsPilot Sybil/bot risk analysis (Pharos)" },
  linkCheck: { price: "$0.005", description: "ProsPilot phishing/link safety scan" },
  preSignRisk: { price: "$0.005", description: "ProsPilot pre-sign calldata risk check" },
  swapSafety: { price: "$0.005", description: "ProsPilot swap safety score" },
  walletScore: { price: "$0.01", description: "ProsPilot wallet intelligence score" },
} as const;
