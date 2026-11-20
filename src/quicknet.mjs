import { QUICKNET_INFO } from './constants.mjs';
import { exactKeys, hex, requireValue, sha256, unhex } from './encoding.mjs';
import { quicknetRoundTime } from './schedule.mjs';
export { QUICKNET_INFO } from './constants.mjs';
export { quicknetRoundAtOrAfter, quicknetRoundTime } from './schedule.mjs';

/** Runs the official client's signature verification against pinned, offline chain data. */
export async function verifyQuicknetBeacon(input, expectedRound) {
  quicknetRoundTime(expectedRound);
  exactKeys(input, ['round','randomness','signature'], 'Quicknet beacon');
  const beacon = { round:input.round, randomness:input.randomness, signature:input.signature };
  requireValue(beacon.round === expectedRound, 'Wrong Quicknet beacon round');
  unhex(beacon.randomness,32,'beacon randomness');
  const signature = unhex(beacon.signature,48,'beacon signature');
  requireValue(hex(await sha256(signature)) === beacon.randomness, 'Beacon randomness differs from SHA-256(signature)');
  let fetchBeacon;
  try { ({ fetchBeacon } = await import('drand-client')); }
  catch { throw new Error('Scheduled draws require optional dependency drand-client@1.4.2; verification cannot be skipped'); }
  const offline = {
    options:{ disableBeaconVerification:false, noCache:true, chainVerificationParams:{ chainHash:QUICKNET_INFO.hash, publicKey:QUICKNET_INFO.public_key } },
    chain:()=>({ baseUrl:'offline-pinned-quicknet', info:async()=>QUICKNET_INFO }),
    get:async round=>{ requireValue(round === expectedRound,'Wrong requested beacon round');return beacon; },
    latest:async()=>{ throw new Error('Latest beacon is forbidden'); },
  };
  await fetchBeacon(offline,expectedRound);
  return beacon;
}

export async function fetchQuicknetBeacon(round, options = {}) {
  quicknetRoundTime(round);
  const relays = ['https://api.drand.sh','https://api2.drand.sh','https://api3.drand.sh'];
  let lastError;
  for (const relay of relays) {
    if (options.signal?.aborted) throw options.signal.reason ?? new Error('Beacon fetch aborted');
    const timeout = AbortSignal.timeout(10000);
    const signal = options.signal ? AbortSignal.any([timeout,options.signal]) : timeout;
    try {
      const response = await fetch(`${relay}/${QUICKNET_INFO.hash}/public/${round}`,{ signal, headers:{ Accept:'application/json' }, credentials:'omit' });
      requireValue(response.ok,`Beacon relay returned HTTP ${response.status}`);
      const data = await response.json();
      return await verifyQuicknetBeacon({ round:data.round, randomness:data.randomness, signature:data.signature },round);
    } catch (error) { lastError = error; }
  }
  throw new Error(`No verified beacon available for round ${round}: ${lastError?.message ?? 'all relays failed'}`);
}
