const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-Memory Chain & Mempool (Can be replaced with mongoose models)
let blockchain = [
  {
    index: 0,
    timestamp: Date.now(),
    transactions: [{ sender: 'SYSTEM', receiver: 'GENESIS', amount: 50 }],
    previousHash: '0',
    hash: '0000a4b7fe8923a41bc901ef45bc781c',
    nonce: 10423
  }
];

let mempool = [
  { id: 'tx-1', sender: 'Alice', receiver: 'Bob', amount: 1.5 },
  { id: 'tx-2', sender: 'Charlie', receiver: 'Dave', amount: 0.8 }
];

// GET: Fetch Full Chain
app.get('/api/chain', (req, res) => {
  res.json({ length: blockchain.length, chain: blockchain });
});

// GET: Fetch Mempool Transactions
app.get('/api/mempool', (req, res) => {
  res.json({ count: mempool.length, mempool });
});

// POST: Add new transaction to mempool
app.post('/api/transaction', (req, res) => {
  const { sender, receiver, amount } = req.body;
  if (!sender || !receiver || !amount) {
    return res.status(400).json({ error: 'Missing required transaction fields.' });
  }

  const newTx = { id: `tx-${Date.now()}`, sender, receiver, amount: parseFloat(amount) };
  mempool.push(newTx);
  res.status(201).json({ message: 'Transaction queued in mempool.', transaction: newTx });
});

// POST: Submit a newly mined block
app.post('/api/mine', (req, res) => {
  const { miner, nonce, hash, previousHash, difficulty } = req.body;

  const targetPrefix = '0'.repeat(difficulty || 3);
  if (!hash.startsWith(targetPrefix)) {
    return res.status(400).json({ status: 'REJECTED', reason: 'Insufficient Proof of Work target.' });
  }

  const lastBlock = blockchain[blockchain.length - 1];
  if (previousHash !== lastBlock.hash) {
    return res.status(409).json({ status: 'ORPHAN', reason: 'Stale block! Previous hash does not match latest tip.' });
  }

  // Package transactions and award coinbase
  const packagedTxs = [...mempool, { sender: 'COINBASE', receiver: miner, amount: 3.125 }];
  mempool = []; // Flush mempool

  const newBlock = {
    index: blockchain.length,
    timestamp: Date.now(),
    transactions: packagedTxs,
    previousHash,
    hash,
    nonce,
    miner
  };

  blockchain.push(newBlock);
  res.status(201).json({ status: 'ACCEPTED', block: newBlock });
});

app.listen(PORT, () => {
  console.log(`Blockchain visualizer server running on http://localhost:${PORT}`);
});