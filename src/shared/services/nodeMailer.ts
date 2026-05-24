import * as dns from "node:dns";
import { createTransport, type Transporter } from "nodemailer";
import { Env } from "../config";

// Prefer IPv4 when supported (Node 17+).
if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

const smtpPort = Env.SMTP_PORT || 587;
const useSSL = smtpPort === 465;
const smtpUser = Env.SMTP_USER || Env.MAILER_EMAIL;
const smtpPass = Env.SMTP_PASS || Env.MAILER_GMAIL_PASSWORD;
const smtpHostname = Env.SMTP_HOST || "mail.privateemail.com";
const smtpHostIp = (process.env.SMTP_HOST_IP || "").trim();

/** Last-resort IPv4 when local DNS cannot resolve PrivateEmail (Windows queryA ETIMEOUT). */
const KNOWN_SMTP_IPV4: Record<string, string> = {
  "mail.privateemail.com": "198.54.122.135",
};

if (!smtpUser || !smtpPass) {
  console.error("⚠️  SMTP Configuration Warning:");
  console.error("   SMTP_USER or SMTP_PASS is not set in environment variables");
}

console.log("📧 SMTP Configuration:");
console.log(
  `   Host: ${smtpHostname}${smtpHostIp ? ` (SMTP_HOST_IP=${smtpHostIp})` : ""}`,
);
console.log(`   Port: ${smtpPort}`);
console.log(`   User: ${smtpUser || "NOT SET"}`);
console.log(`   Password: ${smtpPass ? "***SET***" : "NOT SET"}`);
console.log(`   Secure (SSL): ${useSSL}`);

function isIpv4(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

async function lookupIpv4(hostname: string, servers?: string[]): Promise<string> {
  const previous = dns.getServers();
  if (servers?.length) {
    dns.setServers(servers);
  }
  try {
    const { address } = await dns.promises.lookup(hostname, {
      family: 4,
      hints: dns.ADDRCONFIG,
    });
    return address;
  } finally {
    if (servers?.length && previous.length) {
      dns.setServers(previous);
    }
  }
}

async function resolveSmtpHost(hostname: string): Promise<string> {
  if (isIpv4(hostname)) {
    return hostname;
  }

  if (smtpHostIp && isIpv4(smtpHostIp)) {
    console.log(`📧 SMTP using SMTP_HOST_IP=${smtpHostIp}`);
    return smtpHostIp;
  }

  const customDns = process.env.SMTP_DNS_SERVERS?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  try {
    return await lookupIpv4(hostname, customDns?.length ? customDns : undefined);
  } catch (systemDnsError) {
    console.warn(
      `📧 System DNS failed for ${hostname}: ${(systemDnsError as Error).message}`,
    );
  }

  try {
    const address = await lookupIpv4(hostname, ["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
    console.log(`📧 SMTP resolved ${hostname} → ${address} via public DNS`);
    return address;
  } catch (publicDnsError) {
    const fallback = KNOWN_SMTP_IPV4[hostname.toLowerCase()];
    if (fallback) {
      console.warn(
        `📧 Using built-in SMTP IPv4 fallback for ${hostname}: ${fallback} (${(publicDnsError as Error).message})`,
      );
      return fallback;
    }
    throw publicDnsError;
  }
}

function buildTransportConfig(resolvedHost: string, tlsServername: string) {
  const config: Record<string, unknown> = {
    host: resolvedHost,
    port: smtpPort,
    secure: useSSL,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
    connectionTimeout: 30_000,
    greetingTimeout: 30_000,
    socketTimeout: 60_000,
    tls: {
      rejectUnauthorized: false,
      servername: tlsServername,
    },
  };

  if (!useSSL) {
    config.requireTLS = true;
  }

  return config;
}

let transporterInstance: Transporter | null = null;
let transporterPromise: Promise<Transporter> | null = null;

export function resetSmtpTransporter(): void {
  transporterInstance = null;
  transporterPromise = null;
}

export async function getTransporter(): Promise<Transporter> {
  if (transporterInstance) {
    return transporterInstance;
  }

  if (!transporterPromise) {
    transporterPromise = (async () => {
      const connectHost = await resolveSmtpHost(smtpHostname);
      const tlsServername = smtpHostname;

      console.log(
        `📧 SMTP connecting to ${connectHost}:${smtpPort} (TLS SNI: ${tlsServername})`,
      );

      transporterInstance = createTransport(
        buildTransportConfig(connectHost, tlsServername),
      );
      return transporterInstance;
    })().catch((err) => {
      transporterPromise = null;
      throw err;
    });
  }

  return transporterPromise;
}
