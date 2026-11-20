import { QUICKNET_INFO } from './constants.mjs';
import { requireValue } from './encoding.mjs';

export function quicknetRoundTime(round) {
  requireValue(Number.isSafeInteger(round) && round > 0, 'Invalid Quicknet round');
  const millis = (QUICKNET_INFO.genesis_time + (round - 1) * QUICKNET_INFO.period) * 1000;
  requireValue(Number.isSafeInteger(millis) && millis <= 8640000000000000, 'Quicknet round date is out of range');
  return new Date(millis).toISOString();
}
export function quicknetRoundAtOrAfter(iso) {
  requireValue(typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(iso), 'Schedule must be an ISO UTC timestamp with milliseconds');
  const millis = Date.parse(iso);
  requireValue(Number.isFinite(millis) && new Date(millis).toISOString() === iso, 'Invalid schedule');
  return Math.max(1, Math.ceil((millis / 1000 - QUICKNET_INFO.genesis_time) / QUICKNET_INFO.period) + 1);
}
