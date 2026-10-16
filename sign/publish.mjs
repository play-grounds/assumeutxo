#!/usr/bin/env node
// Publish an attestation file (an already signed kind 3332 event) to relays. Nothing is signed here.
//   node sign/publish.mjs attestations/txbt4-150307/<pubkey>.json [wss://relay …]
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
const { RelayPool } = await import(`${homedir()}/remote/github.com/bitcoin-desktop/headers/publisher/nostr.js`);
const RELAYS = process.argv.slice(3).length ? process.argv.slice(3) : ['wss://nos.lol', 'wss://relay.damus.io', 'wss://nostr.mom', 'wss://relay.primal.net', 'wss://relay.nostr.band', 'wss://nostr.oxtr.dev'];
const ev = JSON.parse(readFileSync(process.argv[2], 'utf8')); if (ev.kind !== 3332 || !ev.sig) throw new Error('not a signed kind 3332 event');
const pool = new RelayPool(RELAYS); const up = await pool.connect(); console.log(`relays up: ${up}/${RELAYS.length}`);
const oks = await pool.publish(ev); console.log(`event ${ev.id}\nacked by ${Array.isArray(oks) ? oks.filter(Boolean).length : oks} relays`); process.exit(0);
