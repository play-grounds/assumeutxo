# assumeutxo experiments

Experiments for the assumeUTXO record at [assumeutxo.com](https://assumeutxo.com/): signing, verifying, endorsing, and the
drafts of the shapes they use. Nothing here is the record. What proves itself graduates to a design issue on
[assumeutxo/assumeutxo.github.io](https://github.com/assumeutxo/assumeutxo.github.io/issues) and to the `assumeutxo` npm package.

- `sign/`: make a formal attestation (statement v2, kind 3332) from a node's own `dumptxoutset` output. [The page](https://play-grounds.github.io/assumeutxo/sign/) signs in the browser (NIP-07 or a pasted key); `sign/attest.mjs` signs from a node over RPC, reading the implementation, build and commit instead of asking.
- `sign/verify.mjs`: check an attestation file: signature, kind, shape, tags against content.
- `endorse/`: one key vouching for another. (next)
- `spec/attestation.md`: the statement (v2: subject and claim), the Nostr envelope (kind 3332, not replaceable), the GPG envelope (next).

MIT.
