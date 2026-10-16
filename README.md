# assumeutxo experiments

Experiments for the assumeUTXO record at [assumeutxo.com](https://assumeutxo.com/): signing, verifying, endorsing, and the
drafts of the shapes they use. Nothing here is the record. What proves itself graduates to a design issue on
[assumeutxo/assumeutxo.github.io](https://github.com/assumeutxo/assumeutxo.github.io/issues) and to the `assumeutxo` npm package.

- `sign/`: make a formal attestation (statement 0.0.1, kind 3332) from a node's own `dumptxoutset` output. [The page](https://play-grounds.github.io/assumeutxo/sign/) signs in the browser (NIP-07 or a pasted key); `sign/attest.mjs` signs from a node over RPC, reading the implementation, build and commit instead of asking.
- `sign/verify.mjs`: check an attestation file: signature, kind, shape, tags against content.
- `endorse/`: [the endorse page](https://play-grounds.github.io/assumeutxo/endorse/): publish the NIP-51 set of keys you control (the controller side of NIP-332's subkeys) and your profile with a NIP-39 GitHub tag, signed by your extension; fields fill from the link.
- `spec/attestation.md`: a pointer; the spec graduated to [NIP-332](https://nip-332.github.io/spec/).

MIT.
