import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const p=await import('../src/index.mjs').catch(()=>({}));
const fixture=JSON.parse(await readFile(new URL('./fixtures/quicknet-34000000.json',import.meta.url),'utf8'));
const input={id:'public-event-1',title:'Public event',rules:'Verified participants only',participants:['a','b','c','d'],winnerCount:2,alternateCount:1,beaconRound:fixture.beacon.round};

test('frozen public proof matches independently checked SHA-256 and selection vector',async()=>{
  const proof=JSON.parse(await readFile(new URL('./fixtures/golden-proof.json',import.meta.url),'utf8'));
  const checked=await p.verifyProof(proof);
  assert.equal(checked.manifestHash,'2a7df43cca0ba80dee18373110d170fc4a43fffae7627e46b7fe11c0f1a89dc6');
  assert.deepEqual(checked.winners,['@bob']);
  assert.deepEqual(checked.alternates,['@alice']);
});

test('real pinned Quicknet beacon verifies offline; altered beacon and wrong rounds fail closed',async()=>{
  assert.equal(typeof p.verifyQuicknetBeacon,'function');
  assert.deepEqual(await p.verifyQuicknetBeacon(fixture.beacon,fixture.beacon.round),fixture.beacon);
  for(const change of [{randomness:'00'.repeat(32)},{signature:'00'.repeat(48)},{round:fixture.beacon.round+1}]){
    await assert.rejects(()=>p.verifyQuicknetBeacon({...fixture.beacon,...change},fixture.beacon.round));
  }
  // Keep signature/hash mutually consistent: only real BLS authentication can reject this.
  const signature='00'.repeat(48),randomness=createHash('sha256').update(Buffer.from(signature,'hex')).digest('hex');
  await assert.rejects(()=>p.verifyQuicknetBeacon({...fixture.beacon,signature,randomness},fixture.beacon.round));
});

test('scheduled proof binds fixed beacon, results and host attestation without claiming witnessed freshness',async()=>{
  assert.equal(typeof p.drawCommitted,'function');
  const manifest=p.createManifest(input),manifestHash=await p.hashManifest(manifest);
  const receipt={type:'host-receipt',id:'receipt-1',eventId:manifest.id,manifestHash,committedAt:new Date(Date.parse(manifest.scheduledAt)-120000).toISOString(),publicUrl:'/tools/random-picker/draws/receipt-1',manifest};
  const proof=await p.drawCommitted(manifest,fixture.beacon,receipt);
  const v=await p.verifyProof(proof);
  assert.equal(v.valid,true);
  assert.equal(v.beaconVerified,true);
  assert.equal(v.commitment.status,'host-attested');
  assert.equal(v.commitment.hostReportedBeforeBeacon,true);
  assert.equal(v.commitment.prepublicationVerified,false);
  assert.match(v.warnings.join(' '),/host|independent/i);
  const changed=structuredClone(proof);changed.commitmentEvidence.manifestHash='00'.repeat(32);
  await assert.rejects(()=>p.verifyProof(changed),/receipt/i);
  const external=await p.drawCommitted(manifest,fixture.beacon,{type:'external-reference',prepublicationVerified:true,url:'https://example.invalid/claim'});
  assert.equal((await p.verifyProof(external)).commitment.prepublicationVerified,false);
  const altered=structuredClone(proof);altered.entropy.beacon.randomness='00'.repeat(32);
  await assert.rejects(()=>p.verifyProof(altered));
});

test('unwitnessed or post-round host receipts do not upgrade the trust claim',async()=>{
  assert.equal(typeof p.drawCommitted,'function');
  const manifest=p.createManifest(input),manifestHash=await p.hashManifest(manifest);
  const noReceipt=await p.verifyProof(await p.drawCommitted(manifest,fixture.beacon));
  assert.equal(noReceipt.commitment.status,'none');
  const proof=await p.drawCommitted(manifest,fixture.beacon,{type:'host-receipt',id:'late',eventId:manifest.id,manifestHash,committedAt:manifest.scheduledAt,publicUrl:'/late'});
  assert.equal((await p.verifyProof(proof)).commitment.hostReportedBeforeBeacon,false);
});
