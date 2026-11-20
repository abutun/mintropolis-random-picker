import { readdir, mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = new URL('../',import.meta.url), dist = new URL('dist/',root);
// Dist is generated only from the package's own source. No bundling obscures the protocol.
await rm(dist,{ recursive:true, force:true });
await mkdir(dist,{ recursive:true });
const hashes = {};
for (const name of (await readdir(new URL('src/',root))).sort()) {
  if (!/\.(mjs|d\.mts)$/.test(name)) continue;
  const source = new URL('src/' + name,root), target = new URL(name,dist);
  if (name.endsWith('.mjs')) {
    const checked = spawnSync(process.execPath,['--check',fileURLToPath(source)],{ encoding:'utf8' });
    if (checked.status !== 0) throw new Error(checked.stderr);
  }
  await copyFile(source,target);
  hashes['src/' + name] = createHash('sha256').update(await readFile(source)).digest('hex');
}
await writeFile(new URL('SOURCE_SHA256.json',dist),JSON.stringify(hashes,null,2) + '\n');
await import(new URL('index.mjs',dist));
process.stdout.write(`Built ${Object.keys(hashes).length} auditable source files; hashes in dist/SOURCE_SHA256.json\n`);
