import test from 'node:test';
import assert from 'node:assert/strict';

const p = await import('../src/index.mjs').catch(() => ({}));
const base = { id:'giveaway-1', title:'Community giveaway', rules:'One entry per verified person.', participants:['@Zed','@ALICE','@bob'], winnerCount:1, alternateCount:1, beaconRound:34000000 };

test('canonical participant pool deduplicates NFC and handles but preserves ordinary label case', () => {
  assert.equal(typeof p.canonicalizeParticipants,'function');
  assert.deepEqual(p.canonicalizeParticipants(' @ALICE \r\n@alice\nCafe\u0301\nCafé\nAlice\n alice \n\n'), ['@alice','Alice','Café','alice']);
  assert.throws(() => p.canonicalizeParticipants(['bad\u0000entry']), /control/i);
  assert.throws(() => p.canonicalizeParticipants(['\ud800']), /unicode/i);
});

test('manifest binds rules, counts and exact Quicknet round time', async () => {
  assert.equal(typeof p.createManifest,'function');
  const m=p.createManifest(base);
  assert.equal(m.rules,base.rules);
  assert.equal(m.mode,'scheduled');
  assert.equal(m.scheduledAt,p.quicknetRoundTime(base.beaconRound));
  assert.deepEqual(m.participants,['@alice','@bob','@zed']);
  assert.match(await p.hashManifest(m),/^[a-f0-9]{64}$/);
  assert.equal(await p.hashManifest(m),'2a7df43cca0ba80dee18373110d170fc4a43fffae7627e46b7fe11c0f1a89dc6');
  assert.equal(await p.hashManifest(m),await p.hashManifest(p.createManifest({...base,participants:[...base.participants].reverse()})));
  assert.notEqual(await p.hashManifest(m),await p.hashManifest(p.createManifest({...base,rules:'Different rules'})));
  assert.throws(()=>p.createManifest({...base,winnerCount:3}),/count/i);
  assert.throws(()=>p.createManifest({...base,scheduledAt:'2030-01-01T00:00:00.000Z'}),/schedule/i);
});

test('quick draw exports reproducible unique winners with explicit rerun warnings', async () => {
  assert.equal(typeof p.drawQuick,'function');
  const proof=await p.drawQuick({...base,beaconRound:undefined});
  assert.equal(proof.manifest.mode,'quick');
  assert.equal(proof.winners.length,1);
  assert.equal(proof.alternates.length,1);
  assert.equal(new Set([...proof.winners,...proof.alternates]).size,2);
  const verified=await p.verifyProof(p.parseProof(p.serializeProof(proof)));
  assert.equal(verified.valid,true);
  assert.equal(verified.beaconVerified,false);
  assert.equal(verified.commitment.prepublicationVerified,false);
  assert.match(verified.warnings.join(' '),/rerun/i);
  const tampered=structuredClone(proof);tampered.winners=['intruder'];
  await assert.rejects(()=>p.verifyProof(tampered),/result/i);
  const changed=structuredClone(proof);changed.manifest.rules='different';
  await assert.rejects(()=>p.verifyProof(changed),/hash/i);
});

test('proof input and manifests reject unknown, noncanonical and invalid fields', async () => {
  assert.equal(typeof p.drawQuick,'function');
  const proof=await p.drawQuick(base);
  for(const mutate of [q=>q.manifest.participants.reverse(),q=>q.manifest.participants.push(q.manifest.participants[0]),q=>q.manifest.beacon={round:34000000},q=>q.manifest.extra='ignored',q=>q.entropy.seed='00',q=>q.winners.push('@fake')]){
    const q=structuredClone(proof);mutate(q);await assert.rejects(()=>p.verifyProof(q));
  }
  assert.throws(()=>p.parseProof('{broken'),/json/i);
});
