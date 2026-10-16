#!/usr/bin/env node
// Experiment: a formal attestation of an assumeUTXO snapshot, statement 0.0.1, signed as a kind 3332 Nostr event (regular, not
// replaceable: a wrong attestation stays; a correction is a new event that references it). Site issues #1 and #4.
// Nothing is typed. From the running node over --rpc: the implementation (BIP 14 user agent), the chainstate provenance
// (getchainstates: full sync or started from a snapshot, validated or not) and, for a node whose tip is the height, the facts
// (gettxoutsetinfo hash_serialized_3). From --from: the JSON that dumptxoutset printed (its mtime is the computation time).
// From --source: the release tag, the commit and the binary's sha256. From --file: the sha256 of the snapshot file written.
//   node sign/attest.mjs --network tbtc4 --height 150000 --from check-150000.json --rpc ~/node/bitcoin.conf --source ~/plumb --file check-150000.dat --method recomputed --key ~/node/agent [--note "…"] [--dry]
import { readFileSync, writeFileSync, mkdirSync, statSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
const HOME = homedir(); const ROOT = process.env.ASSUMEUTXO_SITE ?? `${HOME}/datawiki`; // the record (data/, attestations/)
export const VERSION = '0.0.1', STATEMENT = '0.0.1', KIND = 3332, CLIENT = ['client', 'assumeutxo sign', 'https://play-grounds.github.io/assumeutxo/sign/', VERSION];
const sha256file = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

import { makeRpc } from './rpc.mjs';
export const jcs = (v) => v === null || typeof v !== 'object' ? JSON.stringify(v) : Array.isArray(v) ? '[' + v.map(jcs).join(',') + ']' : '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + jcs(v[k])).join(',') + '}';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; }; const DRY = process.argv.includes('--dry');
const network = arg('--network'), height = Number(arg('--height')), method = arg('--method'), keyDir = arg('--key'), note = arg('--note'), rpcConf = arg('--rpc'), srcDir = arg('--source');
if (!network || !height || !method || !keyDir || !rpcConf) { console.error('need --network --height --method recomputed|loaded --key <agent folder> --rpc <bitcoin.conf> [--from <dumptxoutset json>] [--source <tree>] [--file <dat>] [--note] [--dry]'); process.exit(2); }
if (!['recomputed', 'loaded'].includes(method)) throw new Error('method must be recomputed or loaded');
if (note && (note.length > 200 || /:\/\/|www\./i.test(note))) throw new Error('the note is free text, at most 200 characters, with no links: a statement carries facts, not pointers');
const NETS = JSON.parse(readFileSync(`${ROOT}/data/networks.jsonld`, 'utf8')).networks; const net = NETS.find((n) => n.id === network); if (!net) throw new Error(`network must be one of ${NETS.map((n) => n.id).join(', ')}`);
const genesis = net.genesis ?? NETS.find((n) => '#' + n.id === net.forkOf?.['@id'])?.genesis; if (!genesis) throw new Error('no genesis known for ' + network);

// the node: who it is and where its chainstate came from
const rpc = makeRpc(rpcConf, arg('--datadir') ?? dirname(resolve(rpcConf)));
const implementation = (await rpc('getnetworkinfo')).subversion;
const cs = await rpc('getchainstates'); const active = cs.chainstates.at(-1); // the chainstate in use is listed last
let chainstate;
if (!active.snapshot_blockhash) chainstate = 'full';
else { const h = (await rpc('getblockheader', active.snapshot_blockhash)).height; chainstate = `snapshot:${h}`; }
const validated = !!active.validated;
if (method === 'loaded' && !(active.snapshot_blockhash && validated)) throw new Error(`loaded means: this node started from the snapshot and background validation finished; this node reports chainstate ${chainstate}, validated ${validated}`);
if (method === 'recomputed' && !validated) throw new Error('recomputed needs a validated chainstate');
// the facts
let facts, computedAt;
if (arg('--from')) { const f = arg('--from'); const j = JSON.parse(readFileSync(f, 'utf8')); facts = { height: j.base_height, blockHash: j.base_hash, txoutsetHash: j.txoutset_hash, coins: j.coins_written, chainTxCount: j.nchaintx }; computedAt = statSync(f).mtime.toISOString().slice(0, 19) + 'Z'; }
else { const info = await rpc('gettxoutsetinfo', 'hash_serialized_3'); if (info.height !== height) throw new Error(`the node is at ${info.height}, not ${height}: use --from with a dumptxoutset rollback`); facts = { height: info.height, blockHash: info.bestblock, txoutsetHash: info.hash_serialized_3, coins: info.txouts }; computedAt = new Date().toISOString().slice(0, 19) + 'Z'; }
if (facts.height !== height) throw new Error(`the output is for height ${facts.height}, not ${height}`);
if (method === 'recomputed' && chainstate !== 'full' && Number(chainstate.slice(9)) >= height) throw new Error(`this node's chainstate came from a snapshot at ${chainstate.slice(9)}: it has not recomputed ${height}`);
// the build, when the source tree is given
let build, commit, binarySha256;
if (srcDir) { build = execFileSync('git', ['-C', srcDir, 'describe', '--tags', '--always', '--dirty'], { encoding: 'utf8' }).trim(); commit = execFileSync('git', ['-C', srcDir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); if (build.endsWith('-dirty')) throw new Error('the source tree is dirty: the commit would not describe the binary'); const bin = `${srcDir}/build/bin/bitcoind`; if (existsSync(bin)) binarySha256 = sha256file(bin); }
const fileSha256 = arg('--file') ? sha256file(arg('--file')) : undefined;

// the key: identity lives in the envelope (the event's pubkey), not in the statement
const priv = execFileSync('git', ['-C', keyDir, 'config', '--get', 'nostr.privkey'], { encoding: 'utf8' }).trim(); if (!/^[0-9a-f]{64}$/.test(priv)) throw new Error('no key in ' + keyDir);
const { finalizeEvent, publicKey } = await import(`${HOME}/remote/github.com/bitcoin-desktop/headers/publisher/nostr.js`);
const pub = publicKey(Buffer.from(priv, 'hex')); const did = JSON.parse(readFileSync(`${keyDir}/agent.did.json`, 'utf8')).id; if (did !== 'did:nostr:' + pub) throw new Error('the key does not match agent.did.json');

// the statement: subject (what is attested) and claim (what this node did), canonical (RFC 8785)
const stmt = { v: STATEMENT, '@type': 'Attestation',
  subject: { network, genesis, height, blockHash: facts.blockHash, txoutsetHash: facts.txoutsetHash, hashType: 'hash_serialized_3', ...(facts.coins ? { coins: facts.coins } : {}), ...(facts.chainTxCount ? { chainTxCount: facts.chainTxCount } : {}), ...(fileSha256 ? { fileSha256 } : {}) },
  claim: { method, chainstate, validated, implementation, ...(build ? { build } : {}), ...(commit ? { commit } : {}), ...(binarySha256 ? { binarySha256 } : {}), computedAt, ...(note ? { note } : {}) } };
const content = jcs(stmt);
console.log('statement:\n' + JSON.stringify(stmt, null, 2) + '\nsigner: ' + did + '\ncanonical bytes: ' + content.length);
const S = JSON.parse(readFileSync(`${ROOT}/data/snapshots.json`, 'utf8')).snapshots.find((s) => s.network === network && s.height === height);
console.log(S ? (S.txoutsetHash === stmt.subject.txoutsetHash ? 'matches the entry on the record' : `DISAGREES with the entry on the record (${S.txoutsetHash})`) : 'no entry on the record for this height');
if (DRY) { console.log('dry run: nothing signed'); process.exit(0); }
// the envelope: tags repeat the subject for relay queries; the content is authoritative, and verify checks they agree
const tags = [['v', STATEMENT], ['network', network], ['height', String(height)], ['hash', facts.blockHash], ['txoutset_hash', facts.txoutsetHash], ['method', method], ['implementation', implementation], CLIENT, ['t', 'attestation'], ['t', 'assumeutxo'], ['t', network]];
const ev = finalizeEvent({ kind: KIND, pubkey: pub, created_at: Math.floor(Date.now() / 1000), content, tags }, Buffer.from(priv, 'hex'));
const dir = `${ROOT}/attestations/${network}-${height}`; mkdirSync(dir, { recursive: true }); const file = `${dir}/${pub}.json`;
if (existsSync(file)) throw new Error(`${file} exists: an attestation is not replaced; a correction is a new event that references it`);
writeFileSync(file, JSON.stringify(ev, null, 2) + '\n'); console.log(`signed: ${ev.id}\nwritten: ${file.replace(ROOT + '/', '')}`);
