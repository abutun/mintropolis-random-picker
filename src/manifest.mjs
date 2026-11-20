import { ALGORITHM, PROTOCOL, QUICKNET_INFO } from './constants.mjs';
import { canonicalJSON, exactKeys, hex, requireValue, sha256, text, utf8 } from './encoding.mjs';
import { canonicalizeParticipants } from './participants.mjs';
import { quicknetRoundAtOrAfter, quicknetRoundTime } from './schedule.mjs';

export function createManifest(input) {
  requireValue(input && typeof input === 'object', 'Missing manifest input');
  const id = text(input.id, 96, 'event ID');
  requireValue(/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,95}$/.test(id), 'Invalid event ID');
  const title = text(input.title ?? '', 200, 'title');
  const rules = text(input.rules ?? '', 2000, 'rules', true);
  const participants = canonicalizeParticipants(input.participants);
  const winnerCount = input.winnerCount, alternateCount = input.alternateCount ?? 0;
  requireValue(Number.isSafeInteger(winnerCount) && winnerCount >= 1 && Number.isSafeInteger(alternateCount) && alternateCount >= 0 && winnerCount + alternateCount <= participants.length, 'Invalid winner/alternate count');
  const scheduled = input.beaconRound !== undefined || input.scheduledAt !== undefined;
  let beacon = null, scheduledAt = null;
  if (scheduled) {
    const round = input.beaconRound ?? quicknetRoundAtOrAfter(input.scheduledAt);
    scheduledAt = quicknetRoundTime(round);
    if (input.scheduledAt !== undefined && input.beaconRound !== undefined) requireValue(input.scheduledAt === scheduledAt, 'Schedule differs from the committed beacon round');
    beacon = { chainHash: QUICKNET_INFO.hash, round };
  }
  return { protocol: PROTOCOL, algorithm: ALGORITHM, mode: scheduled ? 'scheduled' : 'quick', id, title, rules, participants, winnerCount, alternateCount, scheduledAt, beacon };
}

export function validateManifest(value) {
  exactKeys(value, ['protocol','algorithm','mode','id','title','rules','participants','winnerCount','alternateCount','scheduledAt','beacon'], 'manifest');
  requireValue(value.protocol === PROTOCOL && value.algorithm === ALGORITHM && ['quick','scheduled'].includes(value.mode), 'Unsupported manifest protocol, algorithm or mode');
  requireValue(Array.isArray(value.participants), 'Invalid participant array');
  if (value.mode === 'scheduled') {
    exactKeys(value.beacon, ['chainHash','round'], 'beacon commitment');
    requireValue(value.beacon.chainHash === QUICKNET_INFO.hash && typeof value.scheduledAt === 'string', 'Wrong beacon chain or schedule');
  } else requireValue(value.beacon === null && value.scheduledAt === null, 'Quick manifest cannot have a beacon');
  const expected = createManifest({ ...value, ...(value.mode === 'scheduled' ? { beaconRound:value.beacon.round } : { scheduledAt:undefined }) });
  requireValue(canonicalJSON(expected) === canonicalJSON(value), 'Manifest is not canonical');
  return expected;
}

export async function hashManifest(manifest) { return hex(await sha256(utf8(canonicalJSON(validateManifest(manifest))))); }
