import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
} from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

let cachedSecret: string | null = null;

export function getDatabasePath(): string {
  return resolve(
    /*turbopackIgnore: true*/ process.env.DATABASE_PATH ||
      join(process.cwd(), "data", "clearstep.db"),
  );
}

export function getDataDir(): string {
  return dirname(getDatabasePath());
}

export function getAppSecret(): string {
  if (cachedSecret) return cachedSecret;

  const configured = process.env.APP_SECRET?.trim();
  if (configured) {
    cachedSecret = configured;
    return cachedSecret;
  }

  const dataDir = getDataDir();
  mkdirSync(dataDir, { recursive: true });
  const secretPath = join(dataDir, ".app-secret");

  if (existsSync(secretPath)) {
    cachedSecret = readFileSync(secretPath, "utf8").trim();
  } else {
    const generated = randomBytes(48).toString("base64url");
    try {
      writeFileSync(secretPath, generated, { mode: 0o600, flag: "wx" });
      cachedSecret = generated;
    } catch {
      cachedSecret = readFileSync(secretPath, "utf8").trim();
    }
  }

  if (!cachedSecret) {
    throw new Error("Could not initialize the application secret.");
  }
  return cachedSecret;
}

function encryptionKey(): Buffer {
  return createHash("sha256").update(getAppSecret()).digest();
}

function previousEncryptionKeys(): Buffer[] {
  const previous = process.env.APP_PREVIOUS_SECRETS?.trim();
  if (!previous) return [];
  return previous
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((secret) => createHash("sha256").update(secret).digest());
}

export function encryptText(value: string | null | undefined): string | null {
  if (!value) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptText(value: string | null | undefined): string {
  if (!value) return "";
  const parts = value.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return "";

  const iv = Buffer.from(parts[1], "base64url");
  const tag = Buffer.from(parts[2], "base64url");
  const ciphertext = Buffer.from(parts[3], "base64url");

  const candidateKeys = [encryptionKey(), ...previousEncryptionKeys()];
  for (const key of candidateKeys) {
    try {
      const decipher = createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]).toString("utf8");
    } catch {
      continue;
    }
  }

  return "";
}

export function hashIdentifier(value: string): string {
  return createHmac("sha256", getAppSecret()).update(value).digest("hex");
}

export function randomId(): string {
  return randomBytes(16).toString("hex");
}
