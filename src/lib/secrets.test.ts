import { describe, expect, it } from "vitest";
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { decryptText, encryptText } from "@/lib/secrets";

describe("secrets and key rotation", () => {
  it("encrypts and decrypts text with the active secret", () => {
    const original = "my secret brain dump context";
    const encrypted = encryptText(original);
    expect(encrypted).not.toBeNull();
    expect(encrypted).not.toBe(original);
    expect(encrypted?.startsWith("v1.")).toBe(true);

    const decrypted = decryptText(encrypted);
    expect(decrypted).toBe(original);
  });

  it("decrypts payloads encrypted with retired secrets via APP_PREVIOUS_SECRETS", () => {
    const retiredSecret = "retired-vault-key-abc-123456789";
    const retiredKey = createHash("sha256").update(retiredSecret).digest();

    const originalText = "historical confidential brain dump";
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", retiredKey, iv);
    const ciphertext = Buffer.concat([
      cipher.update(originalText, "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    const retiredPayload = [
      "v1",
      iv.toString("base64url"),
      tag.toString("base64url"),
      ciphertext.toString("base64url"),
    ].join(".");

    // Without previous secret, decryption returns empty string
    expect(decryptText(retiredPayload)).toBe("");

    // With APP_PREVIOUS_SECRETS set
    process.env.APP_PREVIOUS_SECRETS = `some-other-key,${retiredSecret}`;
    try {
      const recovered = decryptText(retiredPayload);
      expect(recovered).toBe(originalText);
    } finally {
      delete process.env.APP_PREVIOUS_SECRETS;
    }
  });

  it("handles null, empty, and invalid payload formats gracefully", () => {
    expect(encryptText(null)).toBeNull();
    expect(encryptText("")).toBeNull();
    expect(decryptText(null)).toBe("");
    expect(decryptText("")).toBe("");
    expect(decryptText("invalid.payload")).toBe("");
    expect(decryptText("v2.a.b.c")).toBe("");
  });
});
