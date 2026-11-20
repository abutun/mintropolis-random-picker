import test from 'node:test';
import assert from 'node:assert/strict';
const r=await import('../src/random.mjs').catch(()=>({}));

test('bounded sampling rejects the modulo-bias tail',async()=>{
  assert.equal(typeof r.uniformIndex,'function');
  const words=[0xffffffff,5];let calls=0;
  assert.equal(await r.uniformIndex(3,async()=>words[calls++]),2);
  assert.equal(calls,2);
});

test('seeded stream is reproducible and selection never repeats participants',async()=>{
  assert.equal(typeof r.selectParticipants,'function');
  const pool=['a','b','c','d','e'];
  const a=await r.selectParticipants(pool,5,'00'.repeat(32));
  // Independently generated Python hashlib reference vector.
  assert.deepEqual(a,['c','a','d','e','b']);
  assert.deepEqual(a,await r.selectParticipants(pool,5,'00'.repeat(32)));
  assert.equal(new Set(a).size,5);
  assert.deepEqual([...a].sort(),pool);
  assert.notDeepEqual(a,await r.selectParticipants(pool,5,'11'.repeat(32)));
});
