#!/usr/bin/env node
import { readFile, stat } from 'node:fs/promises';
import { parseProof, verifyProof } from './index.mjs';

const args = process.argv.slice(2);
if (args.length !== 1 || args[0] === '--help') {
  const usage = 'Usage: random-picker-verify <proof.json>\nVerifies offline. Exit 0: reproduced; 1: invalid; 2: usage error.\nA reproduced result is not proof of independent prepublication.\n';
  (args[0] === '--help' ? process.stdout : process.stderr).write(usage);
  process.exitCode = args[0] === '--help' ? 0 : 2;
} else {
  try {
    const file = await stat(args[0]);
    if (!file.isFile() || file.size > 8 * 1024 * 1024) throw new Error('Expected a proof JSON file smaller than 8 MiB');
    const result = await verifyProof(parseProof(await readFile(args[0],'utf8')));
    process.stdout.write(JSON.stringify(result,null,2) + '\n');
  } catch (error) {
    process.stderr.write(JSON.stringify({ valid:false, error:error.message }) + '\n');
    process.exitCode = 1;
  }
}
