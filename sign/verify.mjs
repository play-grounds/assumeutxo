#!/usr/bin/env node
// Verify an attestation file: the event's id and signature, the kind, the statement's shape, and that the tags agree with the content.
// With --rpc <bitcoin.conf> of a node on the named chain: that the subject's block hash is on that chain at that height (the label
// 'network' proves nothing by itself; two chains can share a genesis).
//   node sign/verify.mjs attestations/tbtc4-150000/<pubkey>.json [--rpc ~/node/bitcoin.conf [--datadir …]]
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
const { schnorr } = await import(`${homedir()}/remote/github.com/bitcoin-desktop/headers/node_modules/@noble/curves/secp256k1.js`);
const jcs = (v) => v === null || typeof v !== 'object' ? JSON.stringify(v) : Array.isArray(v) ? '[' + v.map(jcs).join(',') + ']' : '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + jcs(v[k])).join(',') + '}';
const ev = JSON.parse(readFileSync(process.argv[2], 'utf8')); const fail = (m) => { console.log('FAIL: ' + m); process.exit(1); };
const id = createHash('sha256').update(JSON.stringify([0, ev.pubkey, ev.created_at, ev.kind, ev.tags, ev.content])).digest('hex');
if (id !== ev.id) fail('id does not match the event'); if (!schnorr.verify(ev.sig, ev.id, ev.pubkey)) fail('signature invalid');
if (ev.kind !== 3332) fail('kind is ' + ev.kind + ', not 3332');
const st = JSON.parse(ev.content); if (jcs(st) !== ev.content) fail('content is not canonical (RFC 8785)');
if (st.v !== '0.0.1' || st['@type'] !== 'Attestation') fail('not an Attestation statement 0.0.1');
const { subject: s, claim: c } = st; for (const k of ['blockHash', 'txoutsetHash', 'hashType']) if (s?.[k] === undefined) fail('subject lacks ' + k); // required
for (const k of ['method', 'chainstate', 'validated']) if (c?.[k] === undefined) fail('claim lacks ' + k);
if (!/^[0-9a-f]{64}$/.test(s.blockHash) || !/^[0-9a-f]{64}$/.test(s.txoutsetHash)) fail('hashes must be 64 hex'); if (s.hashType !== 'hash_serialized_3') fail('hashType ' + s.hashType + ' is not one this verifier knows');
if (!['recomputed', 'loaded'].includes(c.method)) fail('method ' + c.method); if (c.method === 'loaded' && !(c.validated && c.chainstate.startsWith('snapshot:'))) fail('loaded without a validated snapshot chainstate');
if (c.method === 'recomputed' && c.chainstate.startsWith('snapshot:') && Number(c.chainstate.slice(9)) >= s.height) fail('recomputed by a node whose chainstate came from a snapshot at or above the height');
if (c.note && (c.note.length > 200 || /:\/\/|www\./i.test(c.note))) fail('note too long or carries a link');
const tag = (n) => ev.tags.find((t) => t[0] === n)?.[1]; const want = { network: s.network, height: String(s.height), hash: s.blockHash, txoutset_hash: s.txoutsetHash, method: c.method, implementation: c.implementation };
for (const [k, v] of Object.entries(want)) if (tag(k) !== undefined && tag(k) !== v) fail(`tag ${k} disagrees with the content`);
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
if (arg('--rpc')) {
  const { makeRpc } = await import('./rpc.mjs'); const { dirname, resolve } = await import('node:path'); const rpc = makeRpc(arg('--rpc'), arg('--datadir') ?? dirname(resolve(arg('--rpc'))));
  let h; try { h = await rpc('getblockheader', s.blockHash); } catch { fail(`block ${s.blockHash} is not known to the node of ${s.network}`); }
  if (s.height !== undefined && h.height !== s.height) fail(`block is at height ${h.height} on ${s.network}, not ${s.height}`); if (h.confirmations < 1) fail('block is not on the best chain of ' + s.network);
  const g = await rpc('getblockhash', 0); if (s.genesis !== undefined && g !== s.genesis) fail(`genesis differs from the node's: ${g}`);
  console.log(`on chain: ${s.network ?? 'the node'} has ${s.blockHash.slice(0, 16)}… at ${h.height}, ${h.confirmations} confirmations`);
}
console.log(`ok: ${s.network ?? '?'} ${s.height ?? '?'} ${s.txoutsetHash} ${c.method} by did:nostr:${ev.pubkey} (${c.implementation ?? 'implementation not stated'}, ${c.chainstate}${c.computedAt ? ', computed ' + c.computedAt : ''})`);
