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

## Nostr envelope

Kind **3332**, a regular event: not replaceable, not addressable. A wrong attestation stays on the relays; a correction is a new event
that references the old one. The content is the canonical statement. Tags repeat the subject for relay queries (`network`, `height`,
`hash`, `txoutset_hash`, `method`, `implementation`, `t`), and a `client` tag names what signed it. The content is authoritative; a
verifier checks that the tags agree with it and rejects the event if they do not.

## GPG envelope

A clearsign of the canonical statement, with the key's fingerprint as the file name. (Next.)
