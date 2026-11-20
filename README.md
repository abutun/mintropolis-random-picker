# Mintropolis Random Picker

Free, MIT-licensed random draws for community giveaways. Paste an already verified participant pool, freeze the rules, and select unique winners and ordered alternates. No wallet, X account, paid API or blockchain transaction is required by this package.

There are two modes, with different assurances:

| Mode | Entropy | What a verifier can establish |
| --- | --- | --- |
| Quick draw | 32 random bytes from Web Crypto | The exported result reproduces. The organiser can rerun it. |
| Scheduled draw | An exact, signed future drand Quicknet round | The beacon is authentic and the result reproduces for the supplied manifest. Publication before that round requires separate evidence. |

Open source alone does not prove that an organiser used this code, published a pool before the randomness was known, selected the first attempt, checked eligibility correctly, or delivered prizes.

## Run locally

Requires Node 22+ or a modern browser with Web Crypto in a secure context.

```sh
npm ci --ignore-scripts
npm test
npm run build
```

`src/` contains the actual ESM runtime and matching TypeScript declarations. The build copies those files verbatim into `dist/` and records SHA-256 file hashes in `dist/SOURCE_SHA256.json`; no transpilation or bundling hides the protocol. `python3 scripts/source-archive.py` creates deterministic full source archives (`random-picker-source-v1.zip` and `mintropolis-random-picker-source-v1.tar.gz`), including the lockfile and tests; this optional export command uses only Python's standard library. `npm pack` also produces an npm-compatible package with source and tests (npm omits the repository lockfile). This repository does not imply an npm registry release.

```js
import { drawQuick, serializeProof, parseProof, verifyProof } from './src/index.mjs';

const proof = await drawQuick({
  id: 'community-giveaway-2026-11',
  title: 'Community giveaway',
  rules: 'One entry per eligible person; eligibility checked by the organiser.',
  participants: '@Alice\n@BOB\n@carol',
  winnerCount: 1,
  alternateCount: 1,
});

const exported = serializeProof(proof);
const result = await verifyProof(parseProof(exported));
console.log(result.winners, result.warnings);
```

## Scheduled draws

```js
import {
  createManifest, hashManifest, fetchQuicknetBeacon,
  drawCommitted, verifyProof,
} from './src/index.mjs';

const manifest = createManifest({
  id: 'official-community-event-2026-11',
  title: 'Community giveaway',
  rules: 'The first public commitment for this event is final. One entry per eligible person.',
  participants: ['@alice', '@bob', '@carol'],
  winnerCount: 1,
  alternateCount: 1,
  scheduledAt: new Date(Date.now() + 10 * 60_000).toISOString(),
});
const manifestHash = await hashManifest(manifest);

// Publish the complete manifest and hash in a durable, first-write public registry
// NOW, before manifest.scheduledAt. Share the official event link with entrants.
// Save the registry receipt. Independently witness/timestamp the commitment when
// stronger prepublication assurance is required. Do not invent receipt timestamps.

// After the exact selected round becomes available:
const beacon = await fetchQuicknetBeacon(manifest.beacon.round);
const proof = await drawCommitted(manifest, beacon);
const verification = await verifyProof(proof);
console.log(verification.beaconVerified); // true
console.log(verification.commitment.prepublicationVerified); // false
```

If only `scheduledAt` is supplied, `createManifest` selects the first round at or after that timestamp and stores its exact scheduled time. If both `beaconRound` and `scheduledAt` are supplied, they must match exactly. Manifest creation and historical verification do not consult the clock. A hosting service must enforce that new commitments are sufficiently in the future using its own trusted receipt time.

`drand-client@1.4.2` is the optional dependency used for BLS verification. Local quick draws work without it. Scheduled draws fail closed if it is unavailable. The adapter pins Quicknet's chain hash, key, genesis, period and scheme; checks the exact round; checks randomness equals SHA-256(signature); then runs the official client's real signature verifier. It never substitutes the latest beacon. Proof verification is offline; fetching a scheduled beacon uses public HTTPS relays with timeouts.

## Participant normalization

The normalization policy is part of protocol v1:

1. A string input is split on CRLF, CR or LF. A string-array input already contains individual entries.
2. Trim only outer ASCII space, tab, CR and LF; normalize Unicode to NFC; discard empty entries.
3. Lowercase entries matching `^@[A-Za-z0-9_]+$`, retaining `@`. Ordinary labels preserve case. `@Alice` and `@alice` merge; `Alice` and `alice` remain separate, and `alice` differs from `@alice`.
4. Reject malformed Unicode, C0 control characters and DEL. Entries are limited to 256 UTF-8 bytes. Deduplicate exact normalized entries and sort by UTF-8 byte order.
5. Accept 1–10,000 unique participants. Show the canonical pool and duplicate removal to users before commitment. Hosting services may impose tighter documented limits.

These are entry identifiers, not verified identities. Case rules and deduplication do not prevent one person from entering through multiple identities. There are no eligibility scrapers or X/wallet authentication features in v1. Freeze the externally checked pool and rules before drawing. Public scheduled draws necessarily disclose the participant labels: use public handles or consented pseudonyms.

## Verification and receipts

```sh
node src/cli.mjs proof.json
# Or: npm run verify -- proof.json
```

The CLI exits 0 when the supplied result reproduces, 1 on invalid input/proof, and 2 for usage errors. Exit 0 does **not** establish prepublication or eligibility. Read the JSON report's separate `beaconVerified`, `commitment` and `warnings` fields. `verifyProof` throws on malformed input, altered manifests, unauthenticated beacons or mismatching results.

An optional host receipt can be passed as `drawCommitted(manifest, beacon, receipt)`:

```js
{
  type: 'host-receipt',
  id: 'host-assigned-receipt-id',
  eventId: manifest.id,
  manifestHash,
  committedAt: '2026-11-20T12:00:00.000Z', // actual server receipt time
  publicUrl: '/tools/random-picker/draws/host-assigned-receipt-id',
  manifest, // optional duplicate checked against the proof's manifest
}
```

The verifier checks that a host receipt's hash/event/pool match and reports whether its **claimed** time precedes the beacon. Imported receipt JSON has no independently authenticated timestamp or host signature. The result remains `prepublicationVerified: false`. Unknown evidence references also remain unverified, even if they contain fields claiming otherwise. Independently establish when the commitment became public; a self-reported timestamp, mutable web page or organiser-selected historical beacon is insufficient.

Commitment evidence is limited to 256 KiB (262,144 bytes) of canonical UTF-8 JSON. The complete evidence object, including any embedded copy of the manifest, counts toward that size. This byte limit is separate from the participant count and entry-size limits; character counts alone are insufficient for non-ASCII text. Hosting services may accept a smaller commitment POST while returning a larger receipt containing its metadata.

A durable host should independently validate canonical manifests and hashes; insert the full pool/rules/round using one transaction and server time; enforce one immutable commitment per preannounced event ID; return the identical receipt on an identical retry; reject changed retries; and publish the full manifest for anyone to finish the draw. Prevent update/delete through the application role and protect the public log against replacement. Database administrators and the host remain trusted unless an independent witness/timestamp anchors publication. A host receipt makes no claim that hidden duplicate events do not exist.

Because the complete pool and future round are public, anyone can compute the result after the round, even if the organiser stops cooperating. Ordered alternates are drawn at the same time as winners. Do not introduce later redraws or fallback randomness after seeing an outcome. If the beacon is unavailable, wait for the same round rather than switching to a different one.

## Reuse

Import this package from a pinned source commit, use its checked distribution tarball, or vendor `src/*.mjs` and `src/*.d.mts` with this license and provenance. Add `drand-client: "1.4.2"` to the consuming app when scheduled draws are needed. Keep cryptographic and commitment trust reports visible in the product. The core has no React or Mintropolis application dependency.

See [PROTOCOL.md](./PROTOCOL.md) for exact hashing and selection bytes. Tests use Node's built-in runner, deterministic golden vectors, CLI subprocesses and a public real Quicknet beacon; there are no private participant fixtures or live network calls in the test suite.

Upstream references: [drand developer documentation](https://docs.drand.love/developer/), [official JavaScript client](https://github.com/drand/drand-client), [Quicknet introduction](https://docs.drand.love/blog/2023/10/16/quicknet-is-live/).

MIT © 2026 Ahmet Butun / Mintropolis.
