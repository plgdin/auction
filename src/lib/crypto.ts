const SECRET_KEY = "mstc_auction_secure_pdf_key_2026";

/**
 * Encrypt a string (like a PDF URL or path) to an obfuscated URL-safe base64 string.
 */
export function encryptPdfPath(text: string | null | undefined): string {
  if (!text) return "";
  let result = "";
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i) ^ SECRET_KEY.charCodeAt(i % SECRET_KEY.length);
    result += String.fromCharCode(charCode);
  }
  return btoa(result)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Decrypt an obfuscated URL-safe base64 string back to its original value.
 */
export function decryptPdfPath(encoded: string | null | undefined): string {
  if (!encoded) return "";
  let base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  try {
    const text = atob(base64);
    let result = "";
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i) ^ SECRET_KEY.charCodeAt(i % SECRET_KEY.length);
      result += String.fromCharCode(charCode);
    }
    return result;
  } catch (e) {
    return "";
  }
}
