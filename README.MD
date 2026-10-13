# chaincraft studio

an interactive, client-side educational simulation platform designed to demystify blockchain mechanics, cryptographic invariants, and distributed consensus algorithms directly in the browser[cite: 6].

**live demo:** https://chain-craft-studio.netlify.app

---

## overview

chaincraft studio provides an end-to-end visual laboratory that bridges the gap between theoretical distributed systems concepts and practical execution[cite: 6]. users can inspect how digital transactions travel from an unconfirmed mempool into a block header, watch real-time proof-of-work mining races, audit cryptographic nonce forensic traces, and observe peer-to-peer network fork resolution via the longest-chain rule[cite: 6].

---

## key modules & architecture

### 1. blockchain & immutability lab
* **cryptographic hash pointers:** uses the native Web Crypto API (`crypto.subtle.digest`) for hardware-accelerated SHA-256 hash calculation[cite: 5].
* **live tamper detection:** dynamically flags invalid blocks and visually severs downstream linkages when block data or nonces are altered[cite: 5, 6].
* **graphical merkle tree engine:** automatically aggregates comma-separated transactions into leaf nodes, pairs them hierarchically, and renders an interactive SVG branch diagram terminating in the block's merkle root[cite: 5, 6].
* **client-side re-mining:** allows manual re-computation of nonces to restore integrity under target difficulty conditions[cite: 5].

### 2. transactions & mempool
* **unconfirmed transaction pipeline:** simulates standard transaction broadcast workflows[cite: 5, 6].
* **mempool queue management:** buffers broadcasted transfers awaiting block selection and inclusion[cite: 5, 6].
* **automatic block packaging:** automatically flushes pending transactions into newly appended blocks upon generation[cite: 5].

### 3. proof-of-work mining race & forensics
* **asynchronous multi-rig simulation:** runs 4 concurrent miners with varying hardware profiles (ASIC, GPU, Cloud Cluster, Solo CPU) and network latency traits[cite: 5, 6].
* **live cryptographic puzzle cipher:** features real-time hex-dial cycling, elapsed millisecond timers, and deterministic difficulty adjustments[cite: 5, 6].
* **probabilistic winner selection:** calculates winners dynamically based on hardware hashrate distribution rather than static outcomes[cite: 5].
* **forensic failure audits:** breaks down post-race outcomes, distinguishing between hashrate exhaustion, stale work, orphan blocks, and consensus fraud rejection[cite: 5, 6].
* **nonce inspection trace:** displays a side-by-side verification table comparing the first 5 nonces and raw serialized payloads between the fastest and slowest miners[cite: 5, 6].

### 4. decentralized consensus & fork resolution
* **gossip protocol visualizer:** illustrates message propagation delays across global nodes (Node-1 through Node-4)[cite: 5, 6].
* **dynamic network fork:** simulates temporary chain splits when two miners solve candidate blocks concurrently[cite: 5, 6].
* **tug-of-war PoW arena:** visualizes real-time hashrate tension and oscillating competition for the tie-breaking block[cite: 5, 6].
* **longest-chain rule execution:** demonstrates automatic chain reorganization, canonical chain adoption, and orphan branch pruning[cite: 5, 6].

---

## tech stack

* **hosting:** Netlify
* **markup & styling:** semantic HTML5, modern CSS3 (custom properties, flexbox, CSS grid, SVG vector rendering)[cite: 6]
* **scripting:** vanilla JavaScript (ES6+, async/await)[cite: 5]
* **cryptography:** Web Crypto API (`crypto.subtle`) for native SHA-256 digests[cite: 5]
* **typography:** Plus Jakarta Sans & JetBrains Mono[cite: 6]

---

## deployment & usage

access the application directly in your web browser:
👉 **https://chain-craft-studio.netlify.app**

because the simulation is 100% client-side and relies strictly on native browser web APIs, no accounts, background servers, or browser extensions are required[cite: 5].

---

## project structure

```text
├── index.html       # structure, tabs layout, SVG containers, and theory guides
├── style.css        # design system, animations, and typography
└── app.js           # state engine, web crypto functions, merkle math, and race logic