// =========================================================
// HARDWARE-ACCELERATED WEB CRYPTO SHA-256
// =========================================================
async function sha256(str) {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

// =========================================================
// STATE MANAGEMENT
// =========================================================
let blockchain = [];
let mempool = [
  { id: 'tx-1', sender: 'Alice', receiver: 'Bob', amount: 1.5 },
  { id: 'tx-2', sender: 'Charlie', receiver: 'Dave', amount: 0.8 }
];

let peerNodes = [
  { id: 'Node-1 (US-East)', height: 2, headHash: '' },
  { id: 'Node-2 (EU-Central)', height: 2, headHash: '' },
  { id: 'Node-3 (AP-South)', height: 2, headHash: '' },
  { id: 'Node-4 (SA-East)', height: 2, headHash: '' }
];

const MINERS = [
  { id: 'alice', name: 'Alice', power: 42, latency: 40 },
  { id: 'bob', name: 'Bob', power: 22, latency: 120 },
  { id: 'charlie', name: 'Charlie', power: 38, latency: 1800 },
  { id: 'dave', name: 'Dave', power: 10, latency: 250 }
];

let isRaceRunning = false;
let raceTimers = [];
let forkAnimationTimer = null;
let currentAStrength = 50;

// =========================================================
// INITIALIZATION
// =========================================================
document.addEventListener('DOMContentLoaded', async () => {
  setupTabs();
  await initGenesisChain();
  await renderBlockchain();
  renderMempool();
  renderNodes();
  bindEvents();
});

function setupTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));

      btn.classList.add('active');
      const targetContent = document.getElementById(btn.dataset.tab);
      if (targetContent) targetContent.classList.add('active');
    });
  });
}

// =========================================================
// MODULE 1: BLOCKCHAIN & IMMUTABILITY LAB (MERKLE GRAPH)
// =========================================================
async function computeMerkleTreeWithGraph(transactionsStr) {
  let txList = transactionsStr.split(/,|\n/).map(t => t.trim()).filter(Boolean);
  if (txList.length === 0) txList = ["Empty Tx"];
  if (txList.length > 4) txList = txList.slice(0, 4);

  const leaves = [];
  for (let i = 0; i < txList.length; i++) {
    const hash = await sha256(`TX:${txList[i]}`);
    leaves.push({
      label: txList[i].length > 7 ? txList[i].slice(0, 6) + '..' : txList[i],
      hash: hash,
      shortHash: hash.slice(0, 6)
    });
  }

  let parentLayer = [];
  if (leaves.length === 1) {
    parentLayer = [leaves[0]];
  } else {
    for (let i = 0; i < leaves.length; i += 2) {
      const left = leaves[i];
      const right = (i + 1 < leaves.length) ? leaves[i + 1] : left;
      const pHash = await sha256(left.hash + right.hash);
      parentLayer.push({
        label: `H(${left.shortHash}+${right.shortHash})`,
        hash: pHash,
        shortHash: pHash.slice(0, 6),
        children: [i, i + 1 < leaves.length ? i + 1 : i]
      });
    }
  }

  let rootHash = "";
  if (parentLayer.length === 1) {
    rootHash = parentLayer[0].hash;
  } else {
    rootHash = await sha256(parentLayer[0].hash + parentLayer[1].hash);
  }

  return {
    root: rootHash,
    shortRoot: rootHash.slice(0, 6),
    leaves: leaves,
    parents: parentLayer
  };
}

function generateMerkleSVG(tree, isTampered) {
  const width = 250;
  const height = 100;
  const leaves = tree.leaves;
  const numLeaves = leaves.length;

  const rootX = width / 2;
  const rootY = 20;

  const leafSpacing = width / (numLeaves + 1);
  const leafCoords = leaves.map((leaf, idx) => ({
    x: leafSpacing * (idx + 1),
    y: 80,
    ...leaf
  }));

  const lineStrokeClass = isTampered ? "merkle-edge edge-tampered" : "merkle-edge";
  const linesSVG = leafCoords.map(leaf => `
    <line x1="${leaf.x}" y1="${leaf.y}" x2="${rootX}" y2="${rootY}" class="${lineStrokeClass}" />
  `).join('');

  const rootFill = isTampered ? "#FEE2E2" : "#FEF3C7";
  const rootStroke = isTampered ? "#EF4444" : "#F59E0B";
  const rootText = isTampered ? "#991B1B" : "#92400E";

  const leafFill = isTampered ? "#FEE2E2" : "#FFFFFF";
  const leafStroke = isTampered ? "#EF4444" : "#10B981";
  const leafText = isTampered ? "#991B1B" : "#065F46";

  const leavesSVG = leafCoords.map(leaf => `
    <g>
      <circle cx="${leaf.x}" cy="${leaf.y}" r="12" fill="${leafFill}" stroke="${leafStroke}" stroke-width="2" class="merkle-node-circle">
        <title>Leaf Tx: ${leaf.label} | Hash: ${leaf.hash}</title>
      </circle>
      <text x="${leaf.x}" y="${leaf.y + 3.5}" text-anchor="middle" fill="${leafText}" class="merkle-node-label">${leaf.shortHash.slice(0, 4)}</text>
      <text x="${leaf.x}" y="${leaf.y + 19}" text-anchor="middle" fill="#6B655B" style="font-size:7px; font-family:'Plus Jakarta Sans', sans-serif;">${leaf.label}</text>
    </g>
  `).join('');

  const rootSVG = `
    <g>
      <circle cx="${rootX}" cy="${rootY}" r="14" fill="${rootFill}" stroke="${rootStroke}" stroke-width="2.5" class="merkle-node-circle">
        <title>Merkle Root Hash: ${tree.root}</title>
      </circle>
      <text x="${rootX}" y="${rootY + 3.5}" text-anchor="middle" fill="${rootText}" class="merkle-node-label" style="font-size:9px;">${tree.shortRoot.slice(0, 4)}</text>
      <text x="${rootX}" y="${rootY - 10}" text-anchor="middle" fill="${rootText}" style="font-size:7.5px; font-weight:800; text-transform:uppercase;">👑 Root</text>
    </g>
  `;

  return `
    <svg viewBox="0 0 ${width} ${height}" class="merkle-svg-canvas">
      ${linesSVG}
      ${leavesSVG}
      ${rootSVG}
    </svg>
  `;
}

async function initGenesisChain() {
  const gTree = await computeMerkleTreeWithGraph("Genesis Block (Satoshi Archive)");
  const genesisHash = await sha256(`0|0|${gTree.root}|1042`);
  blockchain = [
    {
      index: 0,
      timestamp: Date.now() - 60000,
      data: "Genesis Block (Satoshi Archive)",
      merkleRoot: gTree.root,
      treeData: gTree,
      previousHash: "0".repeat(64),
      nonce: 1042,
      hash: genesisHash,
      isValid: true
    }
  ];

  const b1Data = "Alice -> Bob (1.5 GOLD), Charlie -> Dave (0.8 GOLD)";
  const b1Tree = await computeMerkleTreeWithGraph(b1Data);
  const b1Hash = await sha256(`1|${genesisHash}|${b1Tree.root}|542`);
  blockchain.push({
    index: 1,
    timestamp: Date.now() - 30000,
    data: b1Data,
    merkleRoot: b1Tree.root,
    treeData: b1Tree,
    previousHash: genesisHash,
    nonce: 542,
    hash: b1Hash,
    isValid: true
  });
}

async function renderBlockchain() {
  const container = document.getElementById('chainViewer');
  if (!container) return;
  container.innerHTML = '';

  for (let i = 0; i < blockchain.length; i++) {
    const block = blockchain[i];
    const isTampered = !block.isValid;
    const treeData = block.treeData || await computeMerkleTreeWithGraph(block.data);

    const blockCard = document.createElement('div');
    blockCard.className = `block-card ${isTampered ? 'tampered' : 'valid'}`;
    blockCard.innerHTML = `
      <div class="block-card-header">
        <span class="block-index">Block #${block.index}</span>
        <span class="block-badge ${isTampered ? 'tampered' : 'valid'}">
          ${isTampered ? '⚠️ TAMPERED' : '✓ VALID'}
        </span>
      </div>

      <div class="block-field">
        <label>Data / Transactions (Comma Separated)</label>
        <textarea class="block-input" rows="2" data-index="${block.index}" data-field="data">${block.data}</textarea>
      </div>

      <div class="merkle-graphic-card">
        <div class="merkle-graphic-header">
          <span class="merkle-title">🌿 Merkle Branch Structure</span>
          <span style="font-size: 0.65rem; color: #78350F; font-weight:700;">${treeData.leaves.length} Leaf Nodes</span>
        </div>
        ${generateMerkleSVG(treeData, isTampered)}
      </div>

      <div class="block-field">
        <label>Nonce</label>
        <input type="number" class="block-input" value="${block.nonce}" data-index="${block.index}" data-field="nonce" />
      </div>

      <div class="block-field">
        <label>Previous Hash</label>
        <div class="block-hash">${block.previousHash.slice(0, 18)}...</div>
      </div>

      <div class="block-field">
        <label>Block Hash (Header Digest)</label>
        <div class="block-hash" style="color: ${isTampered ? '#EF4444' : '#10B981'}">${block.hash.slice(0, 18)}...</div>
      </div>

      <button class="btn btn-secondary btn-small remine-btn" data-index="${block.index}">
        🔨 Re-mine Block #${block.index}
      </button>
    `;
    container.appendChild(blockCard);
  }

  container.querySelectorAll('.block-input').forEach(input => {
    input.addEventListener('input', handleBlockDataChange);
  });

  container.querySelectorAll('.remine-btn').forEach(btn => {
    btn.addEventListener('click', (e) => reMineBlock(parseInt(e.target.dataset.index)));
  });
}

async function handleBlockDataChange(e) {
  const index = parseInt(e.target.dataset.index);
  const field = e.target.dataset.field;
  const value = field === 'nonce' ? parseInt(e.target.value) || 0 : e.target.value;

  blockchain[index][field] = value;
  await recalculateChainIntegrity();
  await renderBlockchain();
}

async function recalculateChainIntegrity() {
  for (let i = 0; i < blockchain.length; i++) {
    const prev = blockchain[i - 1];
    if (prev) {
      blockchain[i].previousHash = prev.hash;
    }

    const treeData = await computeMerkleTreeWithGraph(blockchain[i].data);
    blockchain[i].merkleRoot = treeData.root;
    blockchain[i].treeData = treeData;

    const expectedHash = await sha256(
      `${blockchain[i].index}|${blockchain[i].previousHash}|${blockchain[i].merkleRoot}|${blockchain[i].nonce}`
    );

    blockchain[i].hash = expectedHash;

    if (i === 0) {
      blockchain[i].isValid = true;
    } else {
      const prevMatches = blockchain[i].previousHash === prev.hash;
      blockchain[i].isValid = prev.isValid && prevMatches;
    }
  }
}

async function reMineBlock(index) {
  const targetPrefix = "00";
  let nonce = 0;
  let hash = "";

  const treeData = await computeMerkleTreeWithGraph(blockchain[index].data);
  blockchain[index].merkleRoot = treeData.root;
  blockchain[index].treeData = treeData;

  while (true) {
    nonce++;
    hash = await sha256(
      `${blockchain[index].index}|${blockchain[index].previousHash}|${blockchain[index].merkleRoot}|${nonce}`
    );
    if (hash.startsWith(targetPrefix)) break;
    if (nonce > 50000) break;
  }

  blockchain[index].nonce = nonce;
  blockchain[index].hash = hash;

  await recalculateChainIntegrity();
  await renderBlockchain();
}

// =========================================================
// MODULE 2: TRANSACTIONS & MEMPOOL
// =========================================================
function renderMempool() {
  const container = document.getElementById('mempoolContainer');
  const countEl = document.getElementById('mempoolCount');
  if (countEl) countEl.innerText = mempool.length;
  if (!container) return;

  if (mempool.length === 0) {
    container.innerHTML = '<p class="empty-state">Mempool is currently empty. Broadcast a transaction above!</p>';
    return;
  }

  container.innerHTML = mempool.map(tx => `
    <div class="tx-item">
      <div>
        <span>From: <strong>${tx.sender}</strong></span> ➔ 
        <span>To: <strong>${tx.receiver}</strong></span>
      </div>
      <div><strong>${tx.amount} GOLD</strong></div>
    </div>
  `).join('');
}

// =========================================================
// MODULE 3: MINING RACE & LIVE PUZZLE CRACKING
// =========================================================
function pickProbabilisticWinner(minersList, scenario) {
  if (scenario === 'cheat') {
    return Math.random() > 0.5 ? MINERS[0] : MINERS[1];
  }
  
  const totalPower = minersList.reduce((sum, m) => sum + m.power, 0);
  let randomThreshold = Math.random() * totalPower;

  for (const miner of minersList) {
    if (randomThreshold < miner.power) {
      return miner;
    }
    randomThreshold -= miner.power;
  }
  return minersList[0];
}

async function runMiningRace() {
  if (isRaceRunning) return;
  isRaceRunning = true;
  const startBtn = document.getElementById('startRaceBtn');
  if (startBtn) startBtn.disabled = true;

  const difficultyEl = document.getElementById('difficultySelect');
  const targetZeros = parseInt(difficultyEl ? difficultyEl.value : "3");
  const targetPrefix = '0'.repeat(targetZeros);
  const scenarioEl = document.getElementById('scenarioSelect');
  const scenario = scenarioEl ? scenarioEl.value : "fair";

  resetMinerCards();
  const nextBlockHeight = blockchain.length;
  const summaryEl = document.getElementById('winnerSummaryText');
  if (summaryEl) {
    summaryEl.innerHTML = `⚡ <strong>PoW Puzzle Live:</strong> Mining candidate Block #${nextBlockHeight}. Target prefix: <code>${targetPrefix}</code>. Real-time competition running!`;
  }

  const chosenWinner = pickProbabilisticWinner(MINERS, scenario);
  const startTime = Date.now();
  let winnerFound = false;

  MINERS.forEach((miner) => {
    let nonce = 0;
    const card = document.getElementById(`miner-${miner.id}`);
    const statusEl = document.getElementById(`status-${miner.id}`);
    const nonceEl = document.getElementById(`nonce-${miner.id}`);
    const hashEl = document.getElementById(`hash-${miner.id}`);
    const progressEl = document.getElementById(`progress-${miner.id}`);
    const timeEl = document.getElementById(`time-${miner.id}`);
    const cipherEl = document.getElementById(`cipher-${miner.id}`);
    const targetBadge = document.getElementById(`target-${miner.id}`);

    if (targetBadge) targetBadge.innerText = `Target: ${targetPrefix}...`;
    if (statusEl) statusEl.innerText = "Cracking Puzzle...";
    if (card) card.classList.remove('winner', 'loser');

    const intervalTime = Math.max(20, 110 - miner.power * 2);

    const timer = setInterval(async () => {
      if (winnerFound) {
        clearInterval(timer);
        return;
      }

      const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
      if (timeEl) timeEl.innerText = `Time: ${elapsedSeconds}s`;

      nonce += Math.floor(Math.random() * 8) + 1;
      if (nonceEl) nonceEl.innerText = nonce;

      const prevHash = blockchain.length > 0 ? blockchain[blockchain.length - 1].hash : "0";
      let payload = `Block:${nextBlockHeight}|Prev:${prevHash}|Nonce:${nonce}|Miner:${miner.id}`;
      
      if (scenario === 'cheat' && miner.id === 'dave') {
        payload += '|DOUBLE_SPEND_CORRUPT';
      }

      const currentHash = await sha256(payload);
      if (hashEl) hashEl.innerText = currentHash.slice(0, 24) + '...';
      if (progressEl) progressEl.style.width = `${Math.min(100, (nonce % 600) / 6)}%`;

      if (cipherEl) {
        const hexNoise = Array.from({ length: 4 }, () => Math.floor(Math.random() * 65535).toString(16).padStart(4, '0')).join(':');
        cipherEl.innerText = `DIAL: [${hexNoise}] ➔ HASH: ${currentHash.slice(0, 10)}...`;
      }

      const isSolutionFound = currentHash.startsWith(targetPrefix);
      const isDesignatedWinner = miner.id === chosenWinner.id;

      if (isSolutionFound || (nonce > 120 && isDesignatedWinner)) {
        const validWinningHash = currentHash.startsWith(targetPrefix) 
          ? currentHash 
          : targetPrefix + currentHash.slice(targetPrefix.length);

        if (scenario === 'orphan' && miner.id === 'charlie') {
          if (statusEl) statusEl.innerText = "Lagged Broadcast...";
          return;
        }

        if (scenario === 'cheat' && miner.id === 'dave') {
          if (statusEl) statusEl.innerText = "Consensus Rejected!";
          handleFraudRejection(miner);
          return;
        }

        if (!winnerFound && isDesignatedWinner) {
          winnerFound = true;
          stopAllMiners();
          declareRaceWinner(miner, validWinningHash, nonce, nextBlockHeight, elapsedSeconds);
        }
      }
    }, intervalTime);

    raceTimers.push(timer);
  });
}

function stopAllMiners() {
  raceTimers.forEach(t => clearInterval(t));
  raceTimers = [];
  isRaceRunning = false;
  const startBtn = document.getElementById('startRaceBtn');
  if (startBtn) startBtn.disabled = false;
}

async function declareRaceWinner(winner, hash, nonce, blockHeight, elapsedSeconds) {
  const minerCard = document.getElementById(`miner-${winner.id}`);
  const statusEl = document.getElementById(`status-${winner.id}`);
  const cipherEl = document.getElementById(`cipher-${winner.id}`);
  
  if (minerCard) minerCard.classList.add('winner');
  if (statusEl) statusEl.innerText = "CRACKED PUZZLE! 🏆";
  
  if (cipherEl) {
    cipherEl.classList.add('solved');
    cipherEl.innerHTML = `🎯 PUZZLE SOLVED: Nonce #${nonce} produced valid proof ${hash.slice(0, 14)}...`;
  }

  const summaryEl = document.getElementById('winnerSummaryText');
  if (summaryEl) {
    summaryEl.innerHTML = `🏆 <strong>${winner.name}</strong> cracked the PoW puzzle in <strong>${elapsedSeconds}s</strong> (Nonce: <code>${nonce}</code>)! Valid block broadcasted with +3.125 GOLD miner reward.`;
  }

  const packagedData = mempool.length > 0 
    ? mempool.map(t => `${t.sender}➔${t.receiver}(${t.amount}G)`).join(', ')
    : "Coinbase Reward to " + winner.name;

  const treeData = await computeMerkleTreeWithGraph(packagedData);

  blockchain.push({
    index: blockHeight,
    timestamp: Date.now(),
    data: packagedData,
    merkleRoot: treeData.root,
    treeData: treeData,
    previousHash: blockchain.length > 0 ? blockchain[blockchain.length - 1].hash : "0",
    nonce: nonce,
    hash: hash,
    isValid: true
  });

  mempool = [];
  renderMempool();
  await renderBlockchain();
  updatePeerNodesHeads();

  const breakdownEl = document.getElementById('failureBreakdown');
  if (breakdownEl) breakdownEl.innerHTML = '';

  MINERS.forEach(miner => {
    if (miner.id !== winner.id) {
      const card = document.getElementById(`miner-${miner.id}`);
      if (card) card.classList.add('loser');
      explainLoser(miner, winner);
    } else {
      appendForensicItem(miner.name, 'Winner', `Evaluated fastest sequence of candidate digests and achieved target difficulty first.`, 'winner');
    }
  });

  const slowestMiner = MINERS.reduce((prev, curr) => (curr.power < prev.power ? curr : prev), MINERS[0]);
  const difficultyEl = document.getElementById('difficultySelect');
  const targetZeros = parseInt(difficultyEl ? difficultyEl.value : "3");
  renderNonceTrace(winner, slowestMiner, '0'.repeat(targetZeros), blockHeight);
}

function explainLoser(loser, winner) {
  const analysisEl = document.getElementById(`analysis-${loser.id}`);
  const statusEl = document.getElementById(`status-${loser.id}`);
  const cipherEl = document.getElementById(`cipher-${loser.id}`);
  
  if (statusEl) statusEl.innerText = "Stale Work / Halted";
  if (analysisEl) analysisEl.style.display = "block";
  if (cipherEl) {
    cipherEl.innerText = `⛔ HALTED: ${winner.name} found solution first. Work discarded.`;
  }

  const scenarioEl = document.getElementById('scenarioSelect');
  const scenario = scenarioEl ? scenarioEl.value : "fair";
  let title = "Stale Work (Hashrate Deficit)";
  let reason = `Searched nonces too slowly compared to ${winner.name}'s rig. Remaining work discarded.`;
  let type = "stale";

  if (scenario === 'orphan' && loser.id === 'charlie') {
    title = "Orphan Block (Network Latency)";
    reason = `Charlie found a valid nonce nearly concurrently, but high latency (+1.8s) delayed his broadcast. Peers had already accepted ${winner.name}'s block.`;
    type = "orphan";
  }

  if (analysisEl) analysisEl.innerHTML = `<strong>${title}:</strong> ${reason}`;
  appendForensicItem(loser.name, title, reason, type);
}

function handleFraudRejection(miner) {
  const analysisEl = document.getElementById(`analysis-${miner.id}`);
  const cipherEl = document.getElementById(`cipher-${miner.id}`);
  if (analysisEl) {
    analysisEl.style.display = "block";
    analysisEl.innerHTML = `<strong>Consensus Rejection:</strong> Block contained conflicting double-spend inputs. Rejected by validating peers.`;
  }
  if (cipherEl) {
    cipherEl.innerText = `❌ REJECTED: Fraudulent payload detected. Block dropped.`;
  }
  appendForensicItem(miner.name, 'Consensus Rejection', 'Nonce met difficulty target, but transactions failed node ledger invariants.', 'rejected');
}

function appendForensicItem(minerName, badge, message, type) {
  const failureEl = document.getElementById('failureBreakdown');
  if (!failureEl) return;
  const item = document.createElement('div');
  item.className = `reason-item ${type}`;
  item.innerHTML = `<strong>${minerName} [${badge}]:</strong> <span>${message}</span>`;
  failureEl.appendChild(item);
}

function resetMinerCards() {
  MINERS.forEach(miner => {
    const card = document.getElementById(`miner-${miner.id}`);
    if (card) card.classList.remove('winner', 'loser');
    const statusEl = document.getElementById(`status-${miner.id}`);
    const nonceEl = document.getElementById(`nonce-${miner.id}`);
    const hashEl = document.getElementById(`hash-${miner.id}`);
    const progressEl = document.getElementById(`progress-${miner.id}`);
    const analysisEl = document.getElementById(`analysis-${miner.id}`);
    const timeEl = document.getElementById(`time-${miner.id}`);
    const cipherEl = document.getElementById(`cipher-${miner.id}`);

    if (statusEl) statusEl.innerText = "Standby";
    if (nonceEl) nonceEl.innerText = "0";
    if (hashEl) hashEl.innerText = "e3b0c44298fc1c149afbf4c8...";
    if (progressEl) progressEl.style.width = "0%";
    if (timeEl) timeEl.innerText = "Time: 0.0s";
    if (cipherEl) {
      cipherEl.classList.remove('solved');
      cipherEl.innerText = "READY FOR WORK";
    }
    if (analysisEl) {
      analysisEl.style.display = "none";
      analysisEl.innerHTML = "";
    }
  });
}

// =========================================================
// TRACE INSPECTOR: FIRST 5 NONCES
// =========================================================
async function generateTraceSteps(miner, targetPrefix, winningNonce = null, height = 1) {
  const steps = [];
  const minerId = miner.id || miner;

  for (let n = 0; n < 5; n++) {
    const rawPayload = `Block:${height}|Miner:${minerId}|Nonce:${n}`;
    const hash = await sha256(rawPayload);
    steps.push({
      nonce: n,
      hash: hash,
      meetsTarget: hash.startsWith(targetPrefix)
    });
  }

  if (winningNonce !== null && winningNonce >= 5) {
    const winPayload = `Block:${height}|Miner:${minerId}|Nonce:${winningNonce}`;
    const winHash = await sha256(winPayload);
    steps.push({ isSkipped: true, count: winningNonce - 5 });
    steps.push({
      nonce: winningNonce,
      hash: winHash.startsWith(targetPrefix) ? winHash : targetPrefix + winHash.slice(targetPrefix.length),
      meetsTarget: true
    });
  }

  return steps;
}

async function renderNonceTrace(winner, slowestMiner, targetPrefix, height = 1) {
  try {
    const targetBadge = document.getElementById('traceDifficultyTarget');
    const previewEl = document.getElementById('rawBlockPayloadPreview');
    const winnerTitle = document.getElementById('traceWinnerTitle');
    const loserTitle = document.getElementById('traceLoserTitle');
    const winnerTable = document.getElementById('traceWinnerTable');
    const loserTable = document.getElementById('traceLoserTable');

    if (!winnerTable || !loserTable) return;

    if (targetBadge) targetBadge.innerText = `Target: Starts with "${targetPrefix}"`;
    if (winnerTitle) winnerTitle.innerText = `🏆 Fastest Winner (${winner.name})`;
    if (loserTitle) loserTitle.innerText = `🐢 Slowest Miner (${slowestMiner.name})`;
    if (previewEl) previewEl.innerText = `Block:${height}|Miner:${winner.name}|Nonce:[N]`;

    const nonceEl = document.getElementById(`nonce-${winner.id}`);
    const winningNonce = nonceEl ? parseInt(nonceEl.innerText, 10) || 12 : 12;

    const winnerSteps = await generateTraceSteps(winner, targetPrefix, winningNonce, height);
    const loserSteps = await generateTraceSteps(slowestMiner, targetPrefix, null, height);

    winnerTable.innerHTML = winnerSteps.map(step => {
      if (step.isSkipped) {
        return `<tr><td colspan="3" style="text-align:center; color:#888; background:#F8F7F3; padding:5px; font-size:0.68rem;">... ${winner.name} evaluated ${step.count} additional nonces ...</td></tr>`;
      }
      const hit = step.meetsTarget;
      return `
        <tr style="${hit ? 'background:#ECFDF5; font-weight:700;' : ''}">
          <td style="padding:5px 4px;">#${step.nonce}</td>
          <td style="padding:5px 4px; color:${hit ? '#065F46' : '#374151'};">${step.hash.slice(0, 16)}...</td>
          <td style="padding:5px 4px;"><span style="color:${hit ? '#059669' : '#DC2626'};">${hit ? '✅ VALID' : '❌ FAIL'}</span></td>
        </tr>`;
    }).join('');

    loserTable.innerHTML = loserSteps.map(step => `
      <tr>
        <td style="padding:5px 4px;">#${step.nonce}</td>
        <td style="padding:5px 4px; color:#374151;">${step.hash.slice(0, 16)}...</td>
        <td style="padding:5px 4px;"><span style="color:#DC2626;">❌ FAIL</span></td>
      </tr>
    `).join('') + `
      <tr>
        <td colspan="3" style="text-align:center; color:#991B1B; background:#FEF2F2; padding:6px; font-size:0.68rem; font-weight:600;">
          ⛔ Halted at Nonce #4. ${winner.name} broadcasted first; work became stale.
        </td>
      </tr>`;
  } catch (err) {
    console.error("Error in renderNonceTrace:", err);
  }
}

// =========================================================
// MODULE 4: CONSENSUS, GOSSIP & TUG-OF-WAR
// =========================================================
function updatePeerNodesHeads() {
  const latestHash = blockchain.length > 0 ? blockchain[blockchain.length - 1].hash : '';
  peerNodes.forEach(node => {
    node.height = blockchain.length;
    node.headHash = latestHash;
  });
  renderNodes();
}

function renderNodes() {
  const container = document.getElementById('nodesContainer');
  if (!container) return;
  container.innerHTML = peerNodes.map(node => `
    <div class="card node-card">
      <div class="miner-header">
        <h4>${node.id}</h4>
        <span class="badge badge-amber">Height: ${node.height}</span>
      </div>
      <div class="node-chain-list">
        <div><strong>Top Block Hash:</strong></div>
        <div style="color: #6B655B;">${node.headHash ? node.headHash.slice(0, 20) + '...' : 'Synched with Genesis'}</div>
      </div>
      <p style="font-size: 0.78rem; color: #6B655B;">Status: Fully Validated & In Consensus</p>
    </div>
  `).join('');
}

function simulateFork() {
  if (forkAnimationTimer) clearInterval(forkAnimationTimer);

  const gossip = document.getElementById('gossipContainer');
  const tug = document.getElementById('tugOfWarContainer');
  const packetA = document.getElementById('packetA');
  const packetB = document.getElementById('packetB');
  const tugA = document.getElementById('tugBranchA');
  const tugB = document.getElementById('tugBranchB');
  const tugMarker = document.getElementById('tugMarker');
  const tugStatus = document.getElementById('tugStatusText');

  if (gossip) gossip.style.display = 'block';
  if (tug) tug.style.display = 'block';
  if (packetA) packetA.style.left = '0%';
  if (packetB) packetB.style.left = '0%';

  currentAStrength = 50;
  if (tugA) { tugA.style.width = '50%'; tugA.innerText = 'Branch A (50%)'; }
  if (tugB) { tugB.style.width = '50%'; tugB.innerText = 'Branch B (50%)'; }
  if (tugMarker) tugMarker.style.left = '50%';

  setTimeout(() => {
    if (packetA) packetA.style.left = '80%';
    if (packetB) packetB.style.left = '80%';
  }, 50);

  forkAnimationTimer = setInterval(() => {
    const fluctuation = (Math.random() * 12 - 6);
    currentAStrength = Math.min(70, Math.max(30, currentAStrength + fluctuation));
    const currentBStrength = 100 - currentAStrength;

    if (tugA) {
      tugA.style.width = `${currentAStrength}%`;
      tugA.innerText = `Branch A (${Math.round(currentAStrength)}%)`;
    }
    if (tugB) {
      tugB.style.width = `${currentBStrength}%`;
      tugB.innerText = `Branch B (${Math.round(currentBStrength)}%)`;
    }
    if (tugMarker) {
      tugMarker.style.left = `${currentAStrength}%`;
    }

    if (tugStatus) {
      const leader = currentAStrength > 50 ? 'Branch A leading' : 'Branch B leading';
      tugStatus.innerText = `⚡ Racing for Block #4... ${leader} (${Math.round(currentAStrength)}% vs ${Math.round(currentBStrength)}%)`;
      tugStatus.style.color = currentAStrength > 50 ? '#D97706' : '#2563EB';
    }
  }, 450);

  const container = document.getElementById('nodesContainer');
  if (!container) return;
  peerNodes[0].headHash = "0000abc48f9021... (Chain A - Miner Alice)";
  peerNodes[1].headHash = "0000abc48f9021... (Chain A - Miner Alice)";
  peerNodes[2].headHash = "0000ffd83a0091... (Chain B - Miner Charlie)";
  peerNodes[3].headHash = "0000ffd83a0091... (Chain B - Miner Charlie)";

  container.innerHTML = peerNodes.map((node, i) => `
    <div class="card node-card" style="border-color: ${i < 2 ? '#F59E0B' : '#3B82F6'};">
      <div class="miner-header">
        <h4>${node.id}</h4>
        <span class="badge ${i < 2 ? 'badge-amber' : 'badge-slate'}">Forked Height: 3</span>
      </div>
      <div class="node-chain-list">
        <div><strong>Fork Branch:</strong> ${i < 2 ? 'Branch A (Alice)' : 'Branch B (Charlie)'}</div>
        <div style="color: #6B655B;">${node.headHash}</div>
      </div>
      <p style="font-size: 0.78rem; color: #DC2626;">Network split in progress! Awaiting next block proof.</p>
    </div>
  `).join('');
}

function resolveFork() {
  if (forkAnimationTimer) {
    clearInterval(forkAnimationTimer);
    forkAnimationTimer = null;
  }

  const isWinnerA = Math.random() > 0.5;
  const winnerBranch = isWinnerA ? 'A' : 'B';
  const winningMiner = isWinnerA ? 'Alice (Nodes 1 & 2)' : 'Charlie (Nodes 3 & 4)';
  const losingBranch = isWinnerA ? 'Branch B (Charlie)' : 'Branch A (Alice)';

  const tugA = document.getElementById('tugBranchA');
  const tugB = document.getElementById('tugBranchB');
  const tugMarker = document.getElementById('tugMarker');
  const tugStatus = document.getElementById('tugStatusText');

  if (isWinnerA) {
    if (tugA) { tugA.style.width = '100%'; tugA.innerText = 'Branch A WON (100%)'; }
    if (tugB) { tugB.style.width = '0%'; tugB.innerText = ''; }
    if (tugMarker) tugMarker.style.left = '100%';
    if (tugStatus) {
      tugStatus.innerText = '🏆 Branch A mined Block #4 first!';
      tugStatus.style.color = '#15803D';
    }
  } else {
    if (tugA) { tugA.style.width = '0%'; tugA.innerText = ''; }
    if (tugB) { tugB.style.width = '100%'; tugB.innerText = 'Branch B WON (100%)'; }
    if (tugMarker) tugMarker.style.left = '0%';
    if (tugStatus) {
      tugStatus.innerText = '🏆 Branch B mined Block #4 first!';
      tugStatus.style.color = '#1D4ED8';
    }
  }

  const container = document.getElementById('nodesContainer');
  if (container) {
    container.innerHTML = peerNodes.map(node => `
      <div class="card node-card" style="border-color: #10B981;">
        <div class="miner-header">
          <h4>${node.id}</h4>
          <span class="badge badge-amber" style="background:#DCFCE7; color:#166534;">SYNCED: HEIGHT 4</span>
        </div>
        <div class="node-chain-list">
          <div><strong>Canonical Chain:</strong> Branch ${winnerBranch}</div>
          <div style="color: #166534;">00004e2a... [Block #4 Valid]</div>
        </div>
        <p style="font-size: 0.78rem; color: #166534;">✅ Reorganized to the longest cumulative chain</p>
      </div>
    `).join('');
  }

  setTimeout(() => {
    alert(
      `⚖️ Longest Chain Rule Executed!\n\n` +
      `Branch ${winnerBranch} (${winningMiner}) solved Block #4 first, creating the longer chain.\n\n` +
      `All 4 nodes synced to Branch ${winnerBranch}. ${losingBranch} was pruned as an orphan branch!`
    );
  }, 250);
}

// =========================================================
// EVENT BINDINGS
// =========================================================
function bindEvents() {
  const addBlockBtn = document.getElementById('addEmptyBlockBtn');
  if (addBlockBtn) {
    addBlockBtn.addEventListener('click', async () => {
      const prev = blockchain[blockchain.length - 1];
      const newIndex = blockchain.length;

      let blockData = "";
      if (mempool.length > 0) {
        blockData = mempool.map(tx => `${tx.sender}➔${tx.receiver} (${tx.amount}G)`).join(', ');
        mempool = [];
        renderMempool();
      } else {
        blockData = `Alice➔Bob (${(Math.random() * 2 + 0.5).toFixed(1)}G), Charlie➔Dave (${(Math.random() + 0.2).toFixed(1)}G), Miner Reward (3.125G)`;
      }

      const treeData = await computeMerkleTreeWithGraph(blockData);
      let nonce = 0;
      let newHash = "";
      while (true) {
        nonce++;
        newHash = await sha256(`${newIndex}|${prev.hash}|${treeData.root}|${nonce}`);
        if (newHash.startsWith("00")) break;
        if (nonce > 50000) break;
      }

      blockchain.push({
        index: newIndex,
        timestamp: Date.now(),
        data: blockData,
        merkleRoot: treeData.root,
        treeData: treeData,
        previousHash: prev.hash,
        nonce: nonce,
        hash: newHash,
        isValid: true
      });

      await recalculateChainIntegrity();
      await renderBlockchain();
      updatePeerNodesHeads();
    });
  }

  const txForm = document.getElementById('txForm');
  if (txForm) {
    txForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const sender = document.getElementById('txSender').value.trim();
      const receiver = document.getElementById('txReceiver').value.trim();
      const amount = parseFloat(document.getElementById('txAmount').value);

      if (sender && receiver && amount > 0) {
        mempool.push({ id: `tx-${Date.now()}`, sender, receiver, amount });
        renderMempool();
        e.target.reset();
        document.getElementById('txSender').value = 'Alice';
        document.getElementById('txReceiver').value = 'Bob';
        document.getElementById('txAmount').value = '2.5';
      }
    });
  }

  const clearMempoolBtn = document.getElementById('clearMempoolBtn');
  if (clearMempoolBtn) {
    clearMempoolBtn.addEventListener('click', () => {
      mempool = [];
      renderMempool();
    });
  }

  const startRaceBtn = document.getElementById('startRaceBtn');
  if (startRaceBtn) startRaceBtn.addEventListener('click', runMiningRace);

  const resetRaceBtn = document.getElementById('resetRaceBtn');
  if (resetRaceBtn) {
    resetRaceBtn.addEventListener('click', () => {
      stopAllMiners();
      resetMinerCards();
      const summary = document.getElementById('winnerSummaryText');
      if (summary) summary.innerText = 'Hit "Start Mining Race" above to begin concurrent Proof of Work.';
      const failure = document.getElementById('failureBreakdown');
      if (failure) failure.innerHTML = '';
      const wTable = document.getElementById('traceWinnerTable');
      const lTable = document.getElementById('traceLoserTable');
      if (wTable) wTable.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #9CA3AF; padding: 16px;">Start mining race to log trace.</td></tr>';
      if (lTable) lTable.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #9CA3AF; padding: 16px;">Start mining race to log trace.</td></tr>';
    });
  }

  const forkBtn = document.getElementById('simulateForkBtn');
  if (forkBtn) forkBtn.addEventListener('click', simulateFork);

  const resolveBtn = document.getElementById('resolveForkBtn');
  if (resolveBtn) resolveBtn.addEventListener('click', resolveFork);
}