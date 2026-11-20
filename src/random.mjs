import { concat, hex, requireValue, sha256, unhex, utf8 } from './encoding.mjs';

/** Rejection sampling avoids modulo bias. 32-bit words are unsigned big-endian. */
export async function uniformIndex(bound, nextUint32) {
  requireValue(Number.isSafeInteger(bound) && bound >= 1 && bound <= 0x100000000, 'Invalid random index bound');
  const limit = Math.floor(0x100000000 / bound) * bound;
  for (;;) {
    const value = await nextUint32();
    requireValue(Number.isInteger(value) && value >= 0 && value <= 0xffffffff, 'Invalid random word');
    if (value < limit) return value % bound;
  }
}

export async function selectParticipants(participants, count, seedHex) {
  requireValue(Array.isArray(participants) && Number.isSafeInteger(count) && count >= 0 && count <= participants.length, 'Invalid selection count');
  const seed = unhex(seedHex, 32, 'draw seed'), domain = utf8('mintropolis-random-picker/v1/stream\0');
  let counter = 0n, block = new Uint8Array(), offset = 0;
  async function nextUint32() {
    if (offset >= block.length) {
      const bytes = new Uint8Array(8);new DataView(bytes.buffer).setBigUint64(0,counter++,false);
      block = await sha256(concat(domain,seed,bytes));offset = 0;
    }
    const result = new DataView(block.buffer,block.byteOffset + offset,4).getUint32(0,false);offset += 4;return result;
  }
  const pool = [...participants];
  for (let i = 0; i < count; i++) {
    const j = i + await uniformIndex(pool.length - i,nextUint32);
    [pool[i],pool[j]] = [pool[j],pool[i]];
  }
  return pool.slice(0,count);
}

export async function deriveSeed(manifestHash, entropyHex) {
  return hex(await sha256(concat(utf8('mintropolis-random-picker/v1/seed\0'),unhex(manifestHash,32,'manifest hash'),unhex(entropyHex,32,'entropy'))));
}
