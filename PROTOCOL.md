# Protocol v1

The protocol identifier is `mintropolis-random-picker/v1`; proof identifier is `mintropolis-random-picker-proof/v1`; selection algorithm is `sha256-counter-fisher-yates/v1`. These identifiers and all manifest fields are immutable inputs to hashing.

## Canonical manifest

Exactly these fields are accepted; unknown fields are rejected:

```json
{
  "protocol": "mintropolis-random-picker/v1",
  "algorithm": "sha256-counter-fisher-yates/v1",
  "mode": "scheduled",
  "id": "giveaway-1",
  "title": "Community giveaway",
  "rules": "One entry per verified person.",
  "participants": ["@alice", "@bob", "@zed"],
  "winnerCount": 1,
  "alternateCount": 1,
  "scheduledAt": "2026-11-16T04:29:24.000Z",
  "beacon": {
    "chainHash": "52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971",
    "round": 34000000
  }
}
```

This historical example is a verification vector, not a new future commitment. Its SHA-256 manifest hash is `2a7df43cca0ba80dee18373110d170fc4a43fffae7627e46b7fe11c0f1a89dc6`.

Hashing uses UTF-8 JSON with all object keys recursively sorted by ECMAScript string order, no spaces/newline, no ASCII escaping of non-ASCII characters. This schema's keys are ASCII. JSON string escaping follows `JSON.stringify`; numbers are safe integers written in ordinary base 10. Hash is SHA-256 and is represented as 64 lowercase hex characters without `0x`. The participant order is the canonical UTF-8 ordering from README. Proof import requires an already canonical manifest rather than silently fixing one.

IDs match `^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,95}$`. Titles and rules are ASCII-outer-whitespace trimmed and NFC-normalized; limits are 200 and 2,000 UTF-16 code units respectively. Titles reject C0/DEL. Rules allow tab, CR and LF and reject remaining C0/DEL. Neither title nor rules is required to be nonempty by the library. Counts are integers, winner count ≥1, alternate count ≥0, sum ≤ pool size. Weights are unsupported.

A quick manifest uses mode `quick`, `scheduledAt: null` and `beacon: null`. A scheduled manifest has only the pinned Quicknet chain and round; its exact UTC timestamp is `new Date((1692803367 + (round - 1) * 3) * 1000).toISOString()`.

## Entropy and unbiased selection

Quick proofs carry `{ "type": "local", "seed": "<32 random bytes as lowercase hex>" }`. Web Crypto `getRandomValues` supplies the bytes. Scheduled proofs carry `{ "type": "drand", "beacon": { "round": 34000000, "randomness": "<32-byte hex>", "signature": "<48-byte hex>" } }`. The pinned Quicknet verifier must authenticate the signature for the exact manifest round before using its randomness.

The selection seed is:

```text
SHA256(UTF8("mintropolis-random-picker/v1/seed\0")
       || hexDecode(manifestHash)
       || hexDecode(entropy))
```

Here entropy is the local 32-byte seed or verified beacon randomness. `\0` means a single byte zero. Each hash input after the domain is exactly 32 bytes.

The pseudorandom byte stream is successive blocks, starting with counter zero:

```text
SHA256(UTF8("mintropolis-random-picker/v1/stream\0")
       || selectionSeed
       || uint64_big_endian(counter))
```

Read each block as eight unsigned 32-bit big-endian words, in order. To sample `[0,n)`, set `limit = floor(2^32 / n) * n`; reject words `x >= limit`; return `x % n` for the first accepted word. Rejection avoids modulo bias.

Copy the canonical participant array. For `i = 0 .. winnerCount + alternateCount - 1`, sample `offset` in `[0, pool.length - i)`, let `j = i + offset`, and swap `pool[i]` and `pool[j]`. The first `winnerCount` entries are ordered winners; the next `alternateCount` entries are ordered alternates. No participant repeats. There is no time-dependent seed, organiser salt or fallback round.

Independent Python `hashlib` golden vector for the stream/selection helper: a 32-byte all-zero selection seed over `['a','b','c','d','e']` selects `['c','a','d','e','b']`.

## Proof and trust report

The proof has exactly `protocol`, `manifest`, `manifestHash`, `entropy`, `winners`, `alternates`, and `commitmentEvidence`. Proof serialization is pretty JSON for humans; only the canonical manifest representation is hashed. Result arrays are recomputed and compared in exact order. Host receipt fields are described in README.

`valid: true` means the proof is structurally valid, the manifest hash matches, any required beacon verifies, and the ordered result reproduces. It does not authenticate an imported host receipt or prove eligibility/publication/first attempt. `prepublicationVerified` is always false in v1 because no independent witness provider is implemented. A purported external evidence object's own assertion cannot upgrade that value.

The public fixture in `test/fixtures/quicknet-34000000.json` is a captured Quicknet beacon from public drand relays. Offline verification pins the network rather than trusting the fixture's chain metadata.
