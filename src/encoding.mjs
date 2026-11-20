const encoder = new TextEncoder();
export const utf8 = value => encoder.encode(value);
export function requireValue(condition, message) { if (!condition) throw new Error(message); }
export function plainObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value)); }
export function exactKeys(value, keys, label) {
  requireValue(plainObject(value) && Object.keys(value).sort().join('\0') === [...keys].sort().join('\0'), `Invalid ${label} fields`);
}
export function text(value, max, label, multiline = false) {
  requireValue(typeof value === 'string' && value.isWellFormed(), `Invalid ${label} Unicode`);
  const result = value.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '').normalize('NFC');
  requireValue(result.length <= max, `${label} is too long`);
  requireValue(!(multiline ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/ : /[\u0000-\u001f\u007f]/).test(result), `Invalid ${label} control character`);
  return result;
}
export function compareUtf8(a, b) {
  const left = utf8(a), right = utf8(b);
  for (let i = 0; i < Math.min(left.length, right.length); i++) if (left[i] !== right[i]) return left[i] - right[i];
  return left.length - right.length;
}
/** Protocol uses only fixed ASCII keys, strings, arrays, booleans, null and safe integers. */
export function canonicalJSON(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') { requireValue(Number.isSafeInteger(value), 'Non-integer canonical number'); return String(value); }
  if (Array.isArray(value)) return '[' + value.map(canonicalJSON).join(',') + ']';
  requireValue(plainObject(value), 'Invalid canonical JSON value');
  return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonicalJSON(value[key])).join(',') + '}';
}
export const hex = bytes => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
export function unhex(value, length, label = 'hex') {
  requireValue(typeof value === 'string' && new RegExp(`^[a-f0-9]{${length * 2}}$`).test(value), `Invalid ${label}`);
  return Uint8Array.from(value.match(/../g), byte => Number.parseInt(byte, 16));
}
export function cryptoAPI() {
  requireValue(globalThis.crypto?.subtle && globalThis.crypto?.getRandomValues, 'Web Crypto is required (HTTPS browser or Node 22+)');
  return globalThis.crypto;
}
export async function sha256(bytes) { return new Uint8Array(await cryptoAPI().subtle.digest('SHA-256', bytes)); }
export function concat(...parts) {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0; for (const part of parts) { out.set(part, offset); offset += part.length; } return out;
}
