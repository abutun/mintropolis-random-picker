import { PROOF_PROTOCOL } from './constants.mjs';
import { canonicalJSON, cryptoAPI, exactKeys, hex, plainObject, requireValue, unhex, utf8 } from './encoding.mjs';
import { createManifest, hashManifest, validateManifest } from './manifest.mjs';
import { deriveSeed, selectParticipants } from './random.mjs';
import { verifyQuicknetBeacon } from './quicknet.mjs';

function evidenceCopy(evidence) {
  if (evidence === undefined || evidence === null) return null;
  requireValue(plainObject(evidence), 'Commitment evidence must be a JSON object');
  const json = canonicalJSON(evidence);
  requireValue(utf8(json).byteLength <= 256 * 1024, 'Commitment evidence is too large');
  return JSON.parse(json);
}

function inspectEvidence(evidence, manifest, manifestHash) {
  if (evidence === null) return { status:'none', prepublicationVerified:false, hostReportedBeforeBeacon:null };
  if (evidence.type !== 'host-receipt') return { status:'unverified-reference', prepublicationVerified:false, hostReportedBeforeBeacon:null };
  requireValue(evidence.manifestHash === manifestHash && evidence.eventId === manifest.id, 'Host receipt does not bind this manifest');
  requireValue(typeof evidence.committedAt === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(evidence.committedAt), 'Invalid host receipt timestamp');
  const time = Date.parse(evidence.committedAt);
  requireValue(Number.isFinite(time) && new Date(time).toISOString() === evidence.committedAt, 'Invalid host receipt timestamp');
  if (evidence.manifest !== undefined) requireValue(canonicalJSON(validateManifest(evidence.manifest)) === canonicalJSON(manifest), 'Host receipt manifest differs');
  return { status:'host-attested', prepublicationVerified:false, hostReportedBeforeBeacon:manifest.mode === 'scheduled' ? time < Date.parse(manifest.scheduledAt) : null };
}

async function results(manifest, manifestHash, entropyHex) {
  const seed = await deriveSeed(manifestHash,entropyHex);
  const selected = await selectParticipants(manifest.participants,manifest.winnerCount + manifest.alternateCount,seed);
  return { winners:selected.slice(0,manifest.winnerCount), alternates:selected.slice(manifest.winnerCount) };
}

export async function drawQuick(input) {
  const manifest = createManifest({ id:input.id ?? cryptoAPI().randomUUID(), title:input.title ?? '', rules:input.rules ?? '', participants:input.participants, winnerCount:input.winnerCount, alternateCount:input.alternateCount });
  const seed = hex(cryptoAPI().getRandomValues(new Uint8Array(32)));
  const manifestHash = await hashManifest(manifest);
  return { protocol:PROOF_PROTOCOL, manifest, manifestHash, entropy:{ type:'local', seed }, ...await results(manifest,manifestHash,seed), commitmentEvidence:null };
}

export async function drawCommitted(input, inputBeacon, commitmentEvidence = null) {
  const manifest = validateManifest(input), evidence = evidenceCopy(commitmentEvidence);
  requireValue(manifest.mode === 'scheduled', 'A committed draw requires a scheduled manifest');
  // Snapshot untrusted input before awaiting cryptography.
  const beaconInput = structuredClone(inputBeacon);
  const manifestHash = await hashManifest(manifest);
  inspectEvidence(evidence,manifest,manifestHash);
  const beacon = await verifyQuicknetBeacon(beaconInput,manifest.beacon.round);
  return { protocol:PROOF_PROTOCOL, manifest, manifestHash, entropy:{ type:'drand', beacon }, ...await results(manifest,manifestHash,beacon.randomness), commitmentEvidence:evidence };
}

function validateProofShape(input) {
  exactKeys(input,['protocol','manifest','manifestHash','entropy','winners','alternates','commitmentEvidence'],'proof');
  requireValue(input.protocol === PROOF_PROTOCOL, 'Unsupported proof protocol');
  const manifest = validateManifest(input.manifest);
  unhex(input.manifestHash,32,'manifest hash');
  exactKeys(input.entropy,manifest.mode === 'quick' ? ['type','seed'] : ['type','beacon'],'entropy');
  if (manifest.mode === 'quick') {
    requireValue(input.entropy.type === 'local','Wrong quick draw entropy type');unhex(input.entropy.seed,32,'local seed');
  } else {
    requireValue(input.entropy.type === 'drand','Wrong scheduled draw entropy type');
    exactKeys(input.entropy.beacon,['round','randomness','signature'],'beacon');
  }
  requireValue(Array.isArray(input.winners) && input.winners.length === manifest.winnerCount && input.winners.every(x=>typeof x === 'string') && Array.isArray(input.alternates) && input.alternates.length === manifest.alternateCount && input.alternates.every(x=>typeof x === 'string'),'Invalid result arrays');
  return { protocol:PROOF_PROTOCOL, manifest, manifestHash:input.manifestHash, entropy:structuredClone(input.entropy), winners:[...input.winners], alternates:[...input.alternates], commitmentEvidence:evidenceCopy(input.commitmentEvidence) };
}

export function parseProof(json) {
  requireValue(typeof json === 'string' && json.length <= 16 * 1024 * 1024,'Proof JSON is too large or is not a string');
  let value;try { value = JSON.parse(json); } catch { throw new Error('Invalid proof JSON'); }
  return validateProofShape(value);
}
export function serializeProof(proof) { return JSON.stringify(validateProofShape(proof),null,2) + '\n'; }

export async function verifyProof(input) {
  const proof = validateProofShape(input), manifest = proof.manifest;
  const manifestHash = await hashManifest(manifest);
  requireValue(manifestHash === proof.manifestHash,'Manifest hash differs');
  let entropyHex;
  if (manifest.mode === 'scheduled') entropyHex = (await verifyQuicknetBeacon(proof.entropy.beacon,manifest.beacon.round)).randomness;
  else entropyHex = proof.entropy.seed;
  const expected = await results(manifest,manifestHash,entropyHex);
  requireValue(canonicalJSON(expected.winners) === canonicalJSON(proof.winners) && canonicalJSON(expected.alternates) === canonicalJSON(proof.alternates),'Draw result differs from the committed deterministic calculation');
  const commitment = inspectEvidence(proof.commitmentEvidence,manifest,manifestHash);
  const warnings = manifest.mode === 'quick'
    ? ['The organiser can rerun quick draws. A reproducible result does not prove this was the first attempt.']
    : ['A verified beacon and reproducible result do not prove the manifest was published before the beacon. Host timestamps are host attestations; independent prepublication evidence must be checked separately.','Eligibility, one official event commitment and delivery of prizes remain the organiser’s responsibility.'];
  if (commitment.status === 'host-attested' && commitment.hostReportedBeforeBeacon === false) warnings.push('The host receipt reports a time at or after the selected beacon.');
  return { valid:true, mode:manifest.mode, manifestHash, winners:expected.winners, alternates:expected.alternates, beaconVerified:manifest.mode === 'scheduled', commitment, warnings };
}
