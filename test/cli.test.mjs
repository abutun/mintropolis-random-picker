import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {drawQuick,serializeProof} from '../src/index.mjs';
const cli=new URL('../src/cli.mjs',import.meta.url);

test('CLI exits zero only when the proof reproduces; invalid proofs exit one',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'random-picker-cli-'));
  try{
    const file=join(dir,'proof.json');
    const proof=await drawQuick({id:'cli-test',participants:['a','b','c'],winnerCount:1});
    await writeFile(file,serializeProof(proof));
    const good=spawnSync(process.execPath,[cli.pathname,file],{encoding:'utf8'});
    assert.equal(good.status,0,good.stderr);
    assert.equal(JSON.parse(good.stdout).valid,true);
    proof.winners=['outsider'];await writeFile(file,JSON.stringify(proof));
    const bad=spawnSync(process.execPath,[cli.pathname,file],{encoding:'utf8'});
    assert.equal(bad.status,1);
    assert.match(bad.stderr,/result/i);
    assert.equal(JSON.parse(bad.stderr).valid,false);
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('CLI requires an explicit input file',()=>{
  const missing=spawnSync(process.execPath,[cli.pathname],{encoding:'utf8'});
  assert.equal(missing.status,2);
  assert.match(missing.stderr,/usage/i);
});
