import dns from "node:dns/promises";
import net from "node:net";
import tls from "node:tls";

const TIMEOUT_MS = 8_000;
const SLOW_MS = 3_000;

interface Step {
  name: string;
  ok: boolean;
  ms: number;
  detail: string;
}

// Matched against the error text; the first hit wins.
const HINTS: Record<string, string> = {
  ENOTFOUND: "Domain doesn't resolve: typo in the URL, or DNS is down.",
  ECONNREFUSED: "Server is reachable but nothing listens on this port: service is down.",
  ECONNRESET: "Connection was cut mid-way: firewall, proxy or a crashing server.",
  ETIMEDOUT: "No answer at all: server down, firewall dropping packets, or no network.",
  "timed out": "No answer in time: server overloaded, or traffic is being dropped.",
  "due to timeout": "The server accepted the request but never finished answering.",
  CERT_HAS_EXPIRED: "TLS certificate expired: it needs renewing.",
  DEPTH_ZERO_SELF_SIGNED_CERT: "Self-signed certificate: fine on a test env, untrusted elsewhere.",
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: "Certificate chain is incomplete: the server misses an intermediate cert.",
  ERR_TLS_CERT_ALTNAME_INVALID: "Certificate was issued for a different domain name.",
  "redirect loop": "Page redirects to itself: check redirect rules or login/cookie logic.",
  "HTTP 5": "Server-side error: the backend is failing, not the client.",
  "HTTP 401": "Authentication required: missing or expired credentials.",
  "HTTP 403": "Access forbidden: permissions, or the site blocks automated clients.",
  "HTTP 404": "Page not found: wrong path, or the page was removed.",
  "HTTP 429": "Rate limited: too many requests in a short time.",
};

function describe(error: unknown): string {
  const e = error as NodeJS.ErrnoException & { cause?: NodeJS.ErrnoException };
  // fetch only says "fetch failed"; the real reason (ENOTFOUND, ECONNRESET...) hides in `cause`.
  return e.cause?.code ?? e.code ?? e.message ?? String(error);
}

function hintFor(detail: string): string | undefined {
  const key = Object.keys(HINTS).find((k) => detail.includes(k));
  return key ? HINTS[key] : undefined;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function timed(name: string, run: () => Promise<string>): Promise<Step> {
  const start = Date.now();
  try {
    // Await first: inside an object literal, `ms` would be evaluated before the await finishes.
    const detail = await run();
    return { name, ok: true, ms: Date.now() - start, detail };
  } catch (error) {
    return { name, ok: false, ms: Date.now() - start, detail: describe(error) };
  }
}

async function checkDns(host: string): Promise<string> {
  const addresses = await withTimeout(dns.lookup(host, { all: true }), TIMEOUT_MS, "DNS lookup");
  return addresses.map((a) => a.address).join(", ");
}

function checkTcp(host: string, port: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port, timeout: TIMEOUT_MS });
    socket.once("connect", () => {
      socket.destroy();
      resolve(`port ${port} is open`);
    });
    socket.once("timeout", () => {
      socket.destroy();
      reject(new Error("TCP connection timed out"));
    });
    socket.once("error", reject);
  });
}

function checkTls(host: string, port: number): Promise<string> {
  return new Promise((resolve, reject) => {
    // `servername` (SNI) is required: shared hosts otherwise answer with the wrong certificate.
    const socket = tls.connect({ host, port, servername: host, timeout: TIMEOUT_MS }, () => {
      const cert = socket.getPeerCertificate();
      const daysLeft = Math.floor((Date.parse(cert.valid_to) - Date.now()) / 86_400_000);
      socket.destroy();
      const warning = daysLeft < 14 ? " ⚠ expires soon" : "";
      resolve(`certificate valid, ${daysLeft} days left${warning}`);
    });
    socket.once("timeout", () => {
      socket.destroy();
      reject(new Error("TLS handshake timed out"));
    });
    // Invalid certs arrive here, not in the callback above.
    socket.once("error", reject);
  });
}

async function checkHttp(startUrl: string): Promise<string> {
  let url = startUrl;
  const visited = new Set<string>();
  const chain: string[] = [];

  for (let hop = 0; hop < 10; hop++) {
    if (visited.has(url)) {
      throw new Error(`redirect loop detected\n   ${chain.join("\n   ")}`);
    }
    visited.add(url);

    const start = Date.now();
    // "manual" keeps every redirect visible instead of silently following it.
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "user-agent": "page-doctor/1.0" },
    });
    const ms = Date.now() - start;
    chain.push(`${res.status} ${url} (${ms} ms)`);

    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      url = new URL(location, url).href; // Location can be a relative path
      continue;
    }
    if (res.status >= 400) {
      throw new Error(`HTTP ${res.status}\n   ${chain.join("\n   ")}`);
    }

    const body = await res.text();
    const notes: string[] = [];
    if (ms > SLOW_MS) notes.push(`⚠ slow first response (${ms} ms)`);
    if (body.trim().length === 0) notes.push("⚠ empty body: blank page for the user");
    return [
      `HTTP ${res.status}, ${res.headers.get("content-type") ?? "no content-type"}, ${body.length} bytes`,
      ...chain.slice(0, -1).map((c) => `redirected via ${c}`),
      ...notes,
    ].join("\n   ");
  }
  throw new Error(`too many redirects\n   ${chain.join("\n   ")}`);
}

function print(step: Step) {
  console.log(`${step.ok ? "✅" : "❌"} ${step.name} (${step.ms} ms): ${step.detail}`);
  if (!step.ok) {
    const hint = hintFor(step.detail);
    if (hint) console.log(`   → ${hint}`);
  }
}

async function main() {
  const input = process.argv[2];
  if (!input) {
    console.error("Usage: npx tsx tools/pageDoctor.ts <url>");
    process.exit(2);
  }
  const url = new URL(/^https?:\/\//.test(input) ? input : `https://${input}`);
  const secure = url.protocol === "https:";
  const port = Number(url.port) || (secure ? 443 : 80);

  const steps: Array<[string, () => Promise<string>]> = [
    ["DNS lookup", () => checkDns(url.hostname)],
    ["TCP connection", () => checkTcp(url.hostname, port)],
  ];
  if (secure) steps.push(["TLS handshake", () => checkTls(url.hostname, port)]);
  steps.push(["HTTP request", () => checkHttp(url.href)]);

  console.log(`Diagnosing ${url.href}\n`);
  for (const [name, run] of steps) {
    const step = await timed(name, run);
    print(step);
    if (!step.ok) {
      console.log("\nStopped here: later steps can't work until this one is fixed.");
      process.exit(1); // non-zero exit makes it usable as a CI health check
    }
  }
  console.log("\nServer side looks healthy. If the page still fails in a browser, check the console and failed requests.");
}

main();
