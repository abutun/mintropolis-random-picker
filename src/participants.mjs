import { compareUtf8, requireValue, text, utf8 } from './encoding.mjs';

export const MAX_PARTICIPANTS = 10000;
/** NFC; ASCII outer whitespace; @ASCII handles lowercase; unique UTF-8 byte order. */
export function canonicalizeParticipants(raw) {
  requireValue(typeof raw === 'string' || Array.isArray(raw), 'Participants must be lines or a string array');
  const lines = typeof raw === 'string' ? raw.split(/\r\n|\r|\n/) : raw;
  requireValue(lines.length <= MAX_PARTICIPANTS * 4, 'Too many participant input lines');
  const unique = new Set();
  for (const line of lines) {
    let entry = text(line, 256, 'participant');
    if (!entry) continue;
    requireValue(utf8(entry).length <= 256, 'Participant exceeds 256 UTF-8 bytes');
    if (/^@[A-Za-z0-9_]+$/.test(entry)) entry = entry.toLowerCase();
    unique.add(entry);
  }
  requireValue(unique.size > 0 && unique.size <= MAX_PARTICIPANTS, 'Participant count must be between 1 and 10000');
  return [...unique].sort(compareUtf8);
}
