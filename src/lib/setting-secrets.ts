import { encryptCredentials, decryptCredentials } from "./revenue/security";

export function isSecretSetting(key: string): boolean {
  return /(?:^|:)(?:ai_api_key|gemini_api_key|resend_api_key)$/.test(key) || key === "stripe:secret_key";
}

export function sealSetting(key: string, value: string): string {
  return isSecretSetting(key) && value ? encryptCredentials({ value }, `setting:${key}`) : value;
}

export function openSetting(key: string, value: string): string {
  return isSecretSetting(key) && value.startsWith("v1.") ? decryptCredentials(value, `setting:${key}`).value : value;
}
