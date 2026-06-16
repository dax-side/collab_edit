import 'dotenv/config';
import { randomUUID } from 'crypto';
import WebSocket, { RawData } from 'ws';
import { prisma } from '../config/database';
import { type Op, type CharId, type InsertOp } from '../crdt/types';

type ScenarioName = 'single-op' | 'batched-ops';

interface ScenarioConfig {
  name: ScenarioName;
  totalOps: number;
  typeIntervalMs: number;
  batchSize: number;
}

interface ScenarioResult {
  name: ScenarioName;
  totalOps: number;
  outboundMessages: number;
  dbRowsWritten: number;
  estimatedDbWriteBatches: number;
  sendDurationMs: number;
  completionDurationMs: number;
  messageRatePerSec: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
}

interface JoinMessage {
  type: 'join';
  docId: string;
  clientId: string;
}

const HTTP_URL = process.env.BENCH_HTTP_URL ?? process.env.API_BASE_URL ?? 'http://127.0.0.1:3000';
const WS_URL = process.env.BENCH_WS_URL ?? `${HTTP_URL.replace(/^http/, 'ws')}/ws`;

const TOTAL_OPS = Number(process.env.BENCH_TOTAL_OPS ?? 1000);
const TYPE_INTERVAL_MS = Number(process.env.BENCH_TYPE_INTERVAL_MS ?? 5);
const BATCH_SIZE = Number(process.env.BENCH_BATCH_SIZE ?? 10);
const MIRROR_TIMEOUT_MS = Number(process.env.BENCH_MIRROR_TIMEOUT_MS ?? 180_000);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function opKey(op: Op): string {
  if (op.type === 'insert') {
    return `${op.char.id.clientId}:${op.char.id.seq}`;
  }
  return `${op.id.clientId}:${op.id.seq}`;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

async function waitForServerReady(timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${HTTP_URL}/health`);
      if (response.ok) return;
    } catch {
    }

    await sleep(500);
  }

  throw new Error(`Backend is not healthy at ${HTTP_URL}/health after ${timeoutMs}ms`);
}

function connectClient(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);

    const onOpen = () => {
      cleanup();
      resolve(ws);
    };

    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    const cleanup = () => {
      ws.off('open', onOpen);
      ws.off('error', onError);
    };

    ws.on('open', onOpen);
    ws.on('error', onError);
  });
}

function waitForInit(ws: WebSocket, docId: string, timeoutMs = 10_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for init for doc ${docId}`));
    }, timeoutMs);

    const onMessage = (raw: RawData) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw.toString());
      } catch {
        return;
      }

      const msg = parsed as { type?: string; docId?: string; message?: string };
      if (msg.type === 'error') {
        cleanup();
        reject(new Error(`Server error while joining ${docId}: ${msg.message ?? 'unknown'}`));
        return;
      }

      if (msg.type === 'init' && msg.docId === docId) {
        cleanup();
        resolve();
      }
    };

    const cleanup = () => {
      clearTimeout(timer);
      ws.off('message', onMessage);
    };

    ws.on('message', onMessage);
  });
}

function sendJson(ws: WebSocket, payload: unknown): void {
  ws.send(JSON.stringify(payload));
}

function makeInsertOps(totalOps: number, clientId: string): InsertOp[] {
  const ops: InsertOp[] = [];
  let after: CharId | null = null;

  for (let seq = 1; seq <= totalOps; seq++) {
    const id = { clientId, seq };
    ops.push({
      type: 'insert',
      char: {
        id,
        value: 'x',
        deleted: false,
        after,
      },
    });
    after = id;
  }

  return ops;
}

function closeClient(ws: WebSocket): Promise<void> {
  return new Promise((resolve) => {
    if (ws.readyState === WebSocket.CLOSED) {
      resolve();
      return;
    }

    const finish = () => resolve();
    ws.once('close', finish);
    ws.once('error', finish);
    ws.close();
  });
}

async function runScenario(docId: string, config: ScenarioConfig): Promise<ScenarioResult> {
  const senderClientId = `bench-sender-${randomUUID()}`;
  const receiverClientId = `bench-receiver-${randomUUID()}`;

  const sender = await connectClient();
  const receiver = await connectClient();

  try {
    const joinSender: JoinMessage = { type: 'join', docId, clientId: senderClientId };
    const joinReceiver: JoinMessage = { type: 'join', docId, clientId: receiverClientId };

    const senderInitPromise = waitForInit(sender, docId);
    const receiverInitPromise = waitForInit(receiver, docId);

    sendJson(sender, joinSender);
    sendJson(receiver, joinReceiver);

    await Promise.all([senderInitPromise, receiverInitPromise]);

    const startRowCount = await prisma.op.count({ where: { docId } });
    const ops = makeInsertOps(config.totalOps, senderClientId);

    const createdAtByKey = new Map<string, number>();
    const latencies: number[] = [];
    const progressStep = Math.max(1, Math.floor(config.totalOps / 4));

    let outboundMessages = 0;
    let receivedOps = 0;
    let doneResolve: (() => void) | null = null;

    const donePromise = new Promise<void>((resolve) => {
      doneResolve = resolve;
    });

    const onReceiverMessage = (raw: RawData) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw.toString());
      } catch {
        return;
      }

      const msg = parsed as {
        type?: string;
        op?: Op;
        ops?: Op[];
      };

      const incomingOps = msg.type === 'op'
        ? (msg.op ? [msg.op] : [])
        : (msg.type === 'ops' ? (msg.ops ?? []) : []);

      if (incomingOps.length === 0) return;

      const now = Date.now();
      for (const incoming of incomingOps) {
        const key = opKey(incoming);
        const createdAt = createdAtByKey.get(key);
        if (createdAt !== undefined) {
          latencies.push(now - createdAt);
          createdAtByKey.delete(key);
        }

        receivedOps++;

        if (receivedOps % progressStep === 0 || receivedOps === config.totalOps) {
          console.log(`[${config.name}] mirrored ${receivedOps}/${config.totalOps} ops`);
        }
      }

      if (receivedOps >= config.totalOps && doneResolve) {
        doneResolve();
      }
    };

    receiver.on('message', onReceiverMessage);

    const pendingBatch: InsertOp[] = [];

    const flushBatch = () => {
      if (pendingBatch.length === 0) return;

      if (pendingBatch.length === 1) {
        sendJson(sender, { type: 'op', docId, op: pendingBatch[0] });
      } else {
        sendJson(sender, { type: 'ops', docId, ops: [...pendingBatch] });
      }

      outboundMessages++;
      pendingBatch.length = 0;
    };

    const sendStart = Date.now();

    for (const op of ops) {
      createdAtByKey.set(opKey(op), Date.now());

      if (config.batchSize === 1) {
        sendJson(sender, { type: 'op', docId, op });
        outboundMessages++;
      } else {
        pendingBatch.push(op);
        if (pendingBatch.length >= config.batchSize) {
          flushBatch();
        }
      }

      if (config.typeIntervalMs > 0) {
        await sleep(config.typeIntervalMs);
      }
    }

    flushBatch();

    const sendEnd = Date.now();

    await Promise.race([
      donePromise,
      new Promise<void>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Timed out waiting for ${config.totalOps} mirrored ops in ${config.name} (received ${receivedOps})`));
        }, MIRROR_TIMEOUT_MS);
      }),
    ]);

    const completionEnd = Date.now();
    receiver.off('message', onReceiverMessage);

    const endRowCount = await prisma.op.count({ where: { docId } });
    const dbRowsWritten = endRowCount - startRowCount;

    const sendDurationMs = Math.max(1, sendEnd - sendStart);
    const completionDurationMs = Math.max(1, completionEnd - sendStart);

    return {
      name: config.name,
      totalOps: config.totalOps,
      outboundMessages,
      dbRowsWritten,
      estimatedDbWriteBatches: outboundMessages,
      sendDurationMs,
      completionDurationMs,
      messageRatePerSec: Number((outboundMessages / (sendDurationMs / 1000)).toFixed(2)),
      p50LatencyMs: percentile(latencies, 50),
      p95LatencyMs: percentile(latencies, 95),
      p99LatencyMs: percentile(latencies, 99),
    };
  } finally {
    await Promise.all([closeClient(sender), closeClient(receiver)]);
  }
}

function printResult(result: ScenarioResult): void {
  console.log('');
  console.log(`Scenario: ${result.name}`);
  console.log(`  totalOps: ${result.totalOps}`);
  console.log(`  outboundMessages: ${result.outboundMessages}`);
  console.log(`  dbRowsWritten: ${result.dbRowsWritten}`);
  console.log(`  estimatedDbWriteBatches: ${result.estimatedDbWriteBatches}`);
  console.log(`  sendDurationMs: ${result.sendDurationMs}`);
  console.log(`  completionDurationMs: ${result.completionDurationMs}`);
  console.log(`  messageRatePerSec: ${result.messageRatePerSec}`);
  console.log(`  p50LatencyMs: ${result.p50LatencyMs}`);
  console.log(`  p95LatencyMs: ${result.p95LatencyMs}`);
  console.log(`  p99LatencyMs: ${result.p99LatencyMs}`);
}

function printComparison(before: ScenarioResult, after: ScenarioResult): void {
  const pct = (from: number, to: number): string => {
    if (from === 0) return 'n/a';
    return `${(((to - from) / from) * 100).toFixed(2)}%`;
  };

  console.log('');
  console.log('Comparison (single-op -> batched-ops):');
  console.log(`  outboundMessages: ${before.outboundMessages} -> ${after.outboundMessages} (${pct(before.outboundMessages, after.outboundMessages)})`);
  console.log(`  estimatedDbWriteBatches: ${before.estimatedDbWriteBatches} -> ${after.estimatedDbWriteBatches} (${pct(before.estimatedDbWriteBatches, after.estimatedDbWriteBatches)})`);
  console.log(`  dbRowsWritten: ${before.dbRowsWritten} -> ${after.dbRowsWritten} (${pct(before.dbRowsWritten, after.dbRowsWritten)})`);
  console.log(`  messageRatePerSec: ${before.messageRatePerSec} -> ${after.messageRatePerSec} (${pct(before.messageRatePerSec, after.messageRatePerSec)})`);
  console.log(`  p95LatencyMs: ${before.p95LatencyMs} -> ${after.p95LatencyMs} (${pct(before.p95LatencyMs, after.p95LatencyMs)})`);
}

async function main(): Promise<void> {
  console.log(`Using HTTP endpoint: ${HTTP_URL}`);
  console.log(`Using WS endpoint:   ${WS_URL}`);
  console.log('Waiting for backend health check...');
  await waitForServerReady();

  const user = await prisma.user.create({
    data: {
      email: `bench-${randomUUID()}@example.com`,
      password: 'bench-password',
    },
    select: { id: true },
  });

  let singleDocId: string | null = null;
  let batchedDocId: string | null = null;

  try {
    const singleDoc = await prisma.document.create({
      data: { ownerId: user.id },
      select: { id: true },
    });
    singleDocId = singleDoc.id;

    const batchedDoc = await prisma.document.create({
      data: { ownerId: user.id },
      select: { id: true },
    });
    batchedDocId = batchedDoc.id;

    const singleResult = await runScenario(singleDoc.id, {
      name: 'single-op',
      totalOps: TOTAL_OPS,
      typeIntervalMs: TYPE_INTERVAL_MS,
      batchSize: 1,
    });

    const batchedResult = await runScenario(batchedDoc.id, {
      name: 'batched-ops',
      totalOps: TOTAL_OPS,
      typeIntervalMs: TYPE_INTERVAL_MS,
      batchSize: BATCH_SIZE,
    });

    printResult(singleResult);
    printResult(batchedResult);
    printComparison(singleResult, batchedResult);
  } finally {
    if (singleDocId) {
      await prisma.document.delete({ where: { id: singleDocId } }).catch(() => undefined);
    }

    if (batchedDocId) {
      await prisma.document.delete({ where: { id: batchedDocId } }).catch(() => undefined);
    }

    await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
  }
}

main()
  .catch((error) => {
    console.error('Benchmark failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
