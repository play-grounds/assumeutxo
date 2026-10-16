#!/usr/bin/env node
// Experiment: build a formal attestation (site issues #1 and #4): a canonical statement from a node's own output, signed as a kind 33332 Nostr
// event by the key in a folder's git config (npm init agent), written under attestations/<network>-<height>/<npub>.json.
// The node's output is given, never typed: --from <dumptxoutset JSON> (the object dumptxoutset prints) or --rpc <conf> [--datadir, --rpcport]
// for a node whose tip is the height (gettxoutsetinfo hash_serialized_3). --dry prints the statement and signs nothing.
//   node sign/attest.mjs --network tbtc4 --height 150000 --from check-150000.json --method recomputed --key ~/knots-testnet4/shadow-agent --implementation "…" [--note "…"] [--dry]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
const HOME = homedir(); const ROOT = process.env.ASSUMEUTXO_SITE ?? `${HOME}/datawiki`; // the record (data/, attestations/)
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; }; const DRY = process.argv.includes('--dry');
const network = arg('--network'), height = Number(arg('--height')), method = arg('--method'), keyDir = arg('--key'), note = arg('--note');
if (!network || !height || !method || !keyDir) { console.error('need --network --height --method recomputed|loaded --key <agent folder> and --from <json> or --rpc <conf>'); process.exit(2); }
if (!['recomputed', 'loaded'].includes(method)) throw new Error('method must be recomputed or loaded');
const nets = JSON.parse(readFileSync(`${ROOT}/data/networks.jsonld`, 'utf8')).networks.map((n) => n.id); if (!nets.includes(network)) throw new Error(`network must be one of ${nets.join(', ')}`);
// the facts, from the node
let facts, implementation = arg('--implementation');
if (arg('--from')) { const j = JSON.parse(readFileSync(arg('--from'), 'utf8')); facts = { height: j.base_height, blockHash: j.base_hash, txoutsetHash: j.txoutset_hash, coins: j.coins_written, chainTxCount: j.nchaintx }; }
else if (arg('--rpc')) {
  const { makeRpc } = await import(`${HOME}/faucet/lib/rpc.mjs`); const rpc = await makeRpc(arg('--rpc'), 'btc:testnet4-blake2b');
  const info = await rpc('gettxoutsetinfo', 'hash_serialized_3'); if (info.height !== height) throw new Error(`the node is at ${info.height}, not ${height}: use --from with a dumptxoutset rollback`);
  facts = { height: info.height, blockHash: info.bestblock, txoutsetHash: info.hash_serialized_3, coins: info.txouts }; implementation ??= (await rpc('getnetworkinfo')).subversion;
} else throw new Error('give --from <dumptxoutset json> or --rpc <bitcoin.conf>');
if (facts.height !== height) throw new Error(`the output is for height ${facts.height}, not ${height}`);
if (!implementation) throw new Error('--implementation is required with --from (e.g. the node\'s getnetworkinfo subversion)');
// the key
const priv = execFileSync('git', ['-C', keyDir, 'config', '--get', 'nostr.privkey'], { encoding: 'utf8' }).trim(); if (!/^[0-9a-f]{64}$/.test(priv)) throw new Error('no key in ' + keyDir);
const { finalizeEvent, publicKey } = await import(`${HOME}/remote/github.com/bitcoin-desktop/headers/publisher/nostr.js`); const { npub } = await import(`${ROOT}/tools/npub.mjs`);
const pub = publicKey(Buffer.from(priv, 'hex')); const did = JSON.parse(readFileSync(`${keyDir}/agent.did.json`, 'utf8')).id; if (did !== 'did:nostr:' + pub) throw new Error('the key does not match agent.did.json');
// the statement, canonical (JCS: sorted keys, no whitespace)
const stmt = { v: 1, network, height, blockHash: facts.blockHash, txoutsetHash: facts.txoutsetHash, method, implementation, at: new Date().toISOString().slice(0, 10), by: did };
if (facts.coins) stmt.coins = facts.coins; if (facts.chainTxCount) stmt.chainTxCount = facts.chainTxCount; if (note) stmt.note = note;
const jcs = (v) => v === null || typeof v !== 'object' ? JSON.stringify(v) : Array.isArray(v) ? '[' + v.map(jcs).join(',') + ']' : '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + jcs(v[k])).join(',') + '}';
const content = jcs(stmt);
console.log('statement:\n' + content);
// the entry in the record, for the reader's benefit (the statement does not depend on it)
const S = JSON.parse(readFileSync(`${ROOT}/data/snapshots.json`, 'utf8')).snapshots.find((s) => s.network === network && s.height === height);
console.log(S ? (S.txoutsetHash === stmt.txoutsetHash ? 'matches the entry on the record' : `DISAGREES with the entry on the record (${S.txoutsetHash})`) : 'no entry on the record for this height');
if (DRY) { console.log('dry run: nothing signed'); process.exit(0); }
const ev = finalizeEvent({ kind: 33332, pubkey: pub, created_at: Math.floor(Date.now() / 1000), content,
  tags: [['d', `${network}:${height}`], ['network', network], ['height', String(height)], ['hash', stmt.blockHash], ['txoutset_hash', stmt.txoutsetHash], ['method', method], ['implementation', implementation], ['t', 'attestation'], ['t', 'assumeutxo'], ['t', network]] }, Buffer.from(priv, 'hex'));
const dir = `${ROOT}/attestations/${network}-${height}`; mkdirSync(dir, { recursive: true }); const file = `${dir}/${pub}.json`;
writeFileSync(file, JSON.stringify(ev, null, 2) + '\n'); console.log(`signed: ${ev.id}\nwritten: ${file.replace(ROOT + '/', '')}`);
