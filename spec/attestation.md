# Attestation statement, 0.0.1

Draft. `v` is the statement's version, 0.0.1 until the first attestation worth a name is signed, bumped on every change before
that; a verifier reads it first. What a node says about an assumeUTXO snapshot, and the envelope it is signed in. Site issues
[1](https://github.com/assumeutxo/assumeutxo.github.io/issues/1) and [4](https://github.com/assumeutxo/assumeutxo.github.io/issues/4).

## Statement

A JSON object, canonicalised with JCS (RFC 8785) before signing. Two parts: the **subject**, what is attested, the same for every
attester of the same snapshot; and the **claim**, what this node did to know it.

```json
{
  "v": "0.0.1",
  "@type": "Attestation",
  "subject": {
    "network": "tbtc4",
    "genesis": "00000000da84f2bafbbc53dee25a72ae507ff4914b867c565be350b0da8bf043",
    "height": 150000,
    "blockHash": "…",
    "txoutsetHash": "…",
    "hashType": "hash_serialized_3",
    "coins": 14230182,
    "chainTxCount": 14813091,
    "fileSha256": "…"
  },
  "claim": {
    "method": "recomputed",
    "chainstate": "full",
    "validated": true,
    "implementation": "/Satoshi:29.4.2/Knots:20260508/Plumb:6/",
    "build": "v29.4.2.knots20260508.plumb6",
    "commit": "…",
    "binarySha256": "…",
    "computedAt": "2026-10-16T06:17:56Z",
    "note": "…"
  }
}
```

Subject: the snapshot is identified by `genesis`, `height` and `blockHash`, and by nothing else. Two chains can share a genesis
(a fork does), and names and magic bytes are set by the client, so `network` is a label for readers and relay queries, not part of
the identity; a verifier on the record's side checks with a node of the named chain that `blockHash` is on it, and refuses a
mislabelled event. Below a fork point the two chains are one chain: an attestation of a block that lies on more than one chain holds
for all of them, and the record shows it on each. `hashType` names the function behind
`txoutsetHash`: today `hash_serialized_3`. `coins` and `chainTxCount` are what Core's chainparams pin beside the hash. `fileSha256`,
optional, is the snapshot file the node wrote: a possession claim, separate from the hash claim.

Claim: `method` is `recomputed` (this node built the set from blocks) or `loaded` (this node started from the snapshot and background
validation finished; `validated` must be true and `chainstate` must name the snapshot). `chainstate` is where this node's own chainstate
came from, read from `getchainstates`: `full`, or `snapshot:<height>`; a node started from a snapshot at or above the attested height has
recomputed nothing and may not say `recomputed`. `implementation` is the BIP 14 user agent read from the running node. `build`,
`commit` and `binarySha256` are claims about the software, worth what the reproducible builds behind them are worth; readers show them
as said, not as fact. `computedAt` is when the node computed the hash, not when the statement was signed. `note` is at most 200
characters and carries no links.

`@type` is `Attestation`; the JSON-LD context that defines it and the other terms is not in the signed bytes (no hosts in
signed content) and is published beside the record for readers to attach; until it exists the terms are as described here.
Endorsement and FraudProof will be types in the same vocabulary.

There is no signer field: identity lives in the envelope, so the same statement can be signed by a Nostr key or a GPG key.

## Required and optional

The bar today is the informal attestation: a comment on a thread saying "I got this hash", linked. A formal attestation is that
same claim, signed and checkable, and it needs no more than the claim. Required:

- `subject.blockHash`, `subject.txoutsetHash`, `subject.hashType`: the claim.
- `claim.method`, `claim.chainstate`, `claim.validated`: how the node knew it, so `recomputed` cannot be hollow.
- `v` and `@type`.

Everything else is context, filled in when the signer can: `height`, `network` and `genesis` place the block for a reader without a
node (a node derives them from the block hash); `coins` and `chainTxCount` are further facts; `implementation`, `build`, `commit`
and `binarySha256` are self-reported provenance; `computedAt`, `note` and `fileSha256` are context. An optional field, when
present, must be true and is checked like a required one. A page-signed attestation with only the core is valid; a tool-signed
one is the same attestation with more to check.

## Nostr envelope

Kind **3332**, a regular event: not replaceable, not addressable. A wrong attestation stays on the relays; a correction is a new event
that references the old one. The content is the canonical statement. Tags repeat the subject for relay queries (`network`, `height`,
`hash`, `txoutset_hash`, `method`, `implementation`, `t`), and a `client` tag names what signed it. The content is authoritative; a
verifier checks that the tags agree with it and rejects the event if they do not.

The event the tool wrote for the test above (a throwaway key; the content is the canonical statement, one line, shortened here):

```json
{
  "kind": 3332,
  "pubkey": "c77fba35e5cdf0f3e7c37655c6ccd19924c462f5ae9629cf2f9fa0950a59199d",
  "created_at": 1792132900,
  "tags": [
    ["network", "txbt4"],
    ["height", "150307"],
    ["hash", "000000000017ec2251d81c8d2ca401c713e98e85196c7f660a4088a7ca57b1cc"],
    ["txoutset_hash", "372bfcaeef1e93892acccda9e700b00bf90f45d73746d69959d33620a3df5518"],
    ["method", "recomputed"],
    ["implementation", "/Satoshi:29.4.2/Knots:20260508/Plumb:6/"],
    ["client", "assumeutxo sign", "https://play-grounds.github.io/assumeutxo/sign/", "0.0.1"],
    ["t", "attestation"],
    ["t", "assumeutxo"],
    ["t", "txbt4"]
  ],
  "content": "{\"@type\":\"Attestation\",\"claim\":{\"chainstate\":\"full\",…},\"subject\":{\"blockHash\":\"000000000017ec22…\",…},\"v\":\"0.0.1\"}",
  "id": "707332a2ca8390e147fc599bcdfe88dacf7a59b2c0e470a7aba1e15d9af441da",
  "sig": "f17ab2c3b1e5ba74eeba6e778f7cba9974a8a80e9f3e9e8e5e855e15c301338a938bece0fb5453433116f33b5ced3c8b2cd04267bf05a015cba48b8b294f9ecf"
}
```

The file is `attestations/<network>-<height>/<pubkey>.json`, the event as JSON, and `sign/verify.mjs` checks it.

## GPG envelope

A clearsign of the canonical statement, with the key's fingerprint as the file name. (Next.)
