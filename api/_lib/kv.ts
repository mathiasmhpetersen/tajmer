import { Redis } from "@upstash/redis";
import type {
  CorrectionBatch,
  CorrectionField,
  CorrectionMethod,
  PreviewFeedbackItem,
  Role,
} from "../../shared/types.js";

/** env var names that look KV/Redis-related, for diagnostics (names only). */
function kvEnvNames(): string[] {
  return Object.keys(process.env).filter((k) => /KV|UPSTASH|REDIS/i.test(k));
}

/** Thrown when a write is attempted but no KV/Redis is configured yet. */
export class KVError extends Error {
  constructor(message?: string) {
    const names = kvEnvNames();
    super(
      message ??
        `Lager (KV) er ikke konfigureret på serveren${
          names.length ? ` (fundne env-navne: ${names.join(", ")})` : ""
        }`,
    );
    this.name = "KVError";
  }
}

/**
 * Resolve Upstash REST credentials from whatever names Vercel provisioned. Tries
 * the well-known pairs first, then any `*REST_API_URL`/`*REST_API_TOKEN` (or
 * `*REDIS_REST_URL`/`_TOKEN`) pair — the marketplace integration can use a
 * custom prefix.
 */
function resolveCreds(): { url: string; token: string } | null {
  const known: [string, string][] = [
    ["KV_REST_API_URL", "KV_REST_API_TOKEN"],
    ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
  ];
  for (const [u, t] of known) {
    if (process.env[u] && process.env[t]) {
      return { url: process.env[u]!, token: process.env[t]! };
    }
  }
  const urlKey = Object.keys(process.env).find(
    (k) => /(REST_API_URL|REDIS_REST_URL)$/.test(k) && process.env[k]?.startsWith("https"),
  );
  if (urlKey) {
    const tokenKey = urlKey.replace(/URL$/, "TOKEN");
    if (process.env[tokenKey]) {
      return { url: process.env[urlKey]!, token: process.env[tokenKey]! };
    }
  }
  return null;
}

let cached: Redis | null | undefined;

/** Upstash Redis client, or null when no credentials are configured. */
function kv(): Redis | null {
  if (cached !== undefined) return cached;
  const creds = resolveCreds();
  cached = creds ? new Redis(creds) : null;
  return cached;
}

export function kvConfigured(): boolean {
  return kv() !== null;
}

function requireKv(): Redis {
  const client = kv();
  if (!client) throw new KVError();
  return client;
}

export interface ApprovalRecord {
  approvedBy: Role;
  approvedAt: string;
}

// Approval is keyed by creative id as well, so replacing an ad's creative
// resets the approval automatically (§2).
const approvalKey = (adId: string, creativeId: string | null) =>
  `preview:approval:${adId}:${creativeId ?? "none"}`;
const feedbackKey = (adId: string) => `preview:feedback:${adId}`;

export interface AdRef {
  adId: string;
  creativeId: string | null;
}

export interface StoredState {
  approvals: Map<string, ApprovalRecord | null>; // by adId
  feedback: Map<string, PreviewFeedbackItem[]>; // by adId
}

/** Batch-read approval + feedback for a set of ads. Empty when KV is absent. */
export async function readState(refs: AdRef[]): Promise<StoredState> {
  const approvals = new Map<string, ApprovalRecord | null>();
  const feedback = new Map<string, PreviewFeedbackItem[]>();
  const client = kv();
  if (!client || refs.length === 0) {
    for (const r of refs) {
      approvals.set(r.adId, null);
      feedback.set(r.adId, []);
    }
    return { approvals, feedback };
  }

  const approvalVals = (await client.mget<(ApprovalRecord | null)[]>(
    ...refs.map((r) => approvalKey(r.adId, r.creativeId)),
  )) as (ApprovalRecord | null)[];
  const feedbackVals = (await client.mget<(PreviewFeedbackItem[] | null)[]>(
    ...refs.map((r) => feedbackKey(r.adId)),
  )) as (PreviewFeedbackItem[] | null)[];

  refs.forEach((r, i) => {
    approvals.set(r.adId, approvalVals[i] ?? null);
    feedback.set(r.adId, feedbackVals[i] ?? []);
  });
  return { approvals, feedback };
}

export async function getFeedback(adId: string): Promise<PreviewFeedbackItem[]> {
  const client = kv();
  if (!client) return [];
  return (await client.get<PreviewFeedbackItem[]>(feedbackKey(adId))) ?? [];
}

export async function setApproval(
  adId: string,
  creativeId: string | null,
  role: Role,
): Promise<ApprovalRecord> {
  const record: ApprovalRecord = { approvedBy: role, approvedAt: new Date().toISOString() };
  await requireKv().set(approvalKey(adId, creativeId), record);
  return record;
}

export async function clearApproval(adId: string, creativeId: string | null): Promise<void> {
  await requireKv().del(approvalKey(adId, creativeId));
}

export async function addFeedback(
  adId: string,
  creativeId: string | null,
  text: string,
  role: Role,
  meta: { batchId?: string; field?: CorrectionField; method?: CorrectionMethod } = {},
): Promise<PreviewFeedbackItem> {
  const client = requireKv();
  const list = (await client.get<PreviewFeedbackItem[]>(feedbackKey(adId))) ?? [];
  const item: PreviewFeedbackItem = {
    id: crypto.randomUUID(),
    text,
    role,
    createdAt: new Date().toISOString(),
    resolved: false,
    ...(meta.batchId ? { batchId: meta.batchId } : {}),
    ...(meta.field ? { field: meta.field } : {}),
    ...(meta.method ? { method: meta.method } : {}),
  };
  list.push(item);
  await client.set(feedbackKey(adId), list);
  // A correction removes any standing approval (§3).
  await client.del(approvalKey(adId, creativeId));
  return item;
}

const batchKey = (batchId: string) => `preview:batch:${batchId}`;

/** One "Ret på flere annoncer" batch: a correction per ad + a stored batch. */
export async function createBatchCorrection(input: {
  artistSlug: string;
  field: CorrectionField;
  method: CorrectionMethod;
  text: string;
  items: { adId: string; creativeId: string | null }[];
  role: Role;
}): Promise<CorrectionBatch> {
  const client = requireKv();
  const batch: CorrectionBatch = {
    batchId: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    role: input.role,
    artistSlug: input.artistSlug,
    field: input.field,
    method: input.method,
    text: input.text,
    adIds: input.items.map((i) => i.adId),
    creativeIds: input.items.map((i) => i.creativeId),
  };
  await client.set(batchKey(batch.batchId), batch);
  for (const item of input.items) {
    await addFeedback(item.adId, item.creativeId, input.text, input.role, {
      batchId: batch.batchId,
      field: input.field,
      method: input.method,
    });
  }
  return batch;
}

export async function getBatch(batchId: string): Promise<CorrectionBatch | null> {
  const client = kv();
  if (!client) return null;
  return (await client.get<CorrectionBatch>(batchKey(batchId))) ?? null;
}

/** Resolve every per-ad correction tied to a batch. */
export async function resolveBatch(
  batchId: string,
  role: Role,
  extra: { note?: string; fixedAdIds?: Record<string, string> } = {},
): Promise<number> {
  const batch = await getBatch(batchId);
  if (!batch) return 0;
  let resolved = 0;
  for (const adId of batch.adIds) {
    const list = (await requireKv().get<PreviewFeedbackItem[]>(feedbackKey(adId))) ?? [];
    let changed = false;
    for (const item of list) {
      if (item.batchId === batchId && !item.resolved) {
        item.resolved = true;
        item.resolvedBy = role;
        item.resolvedAt = new Date().toISOString();
        if (extra.note) item.resolvedNote = extra.note;
        if (extra.fixedAdIds?.[adId]) item.fixedAdId = extra.fixedAdIds[adId];
        changed = true;
        resolved += 1;
      }
    }
    if (changed) await requireKv().set(feedbackKey(adId), list);
  }
  return resolved;
}

export async function resolveFeedback(
  adId: string,
  feedbackId: string,
  role: Role,
  extra: { note?: string; fixedAdId?: string } = {},
): Promise<boolean> {
  const client = requireKv();
  const list = (await client.get<PreviewFeedbackItem[]>(feedbackKey(adId))) ?? [];
  const item = list.find((f) => f.id === feedbackId);
  if (!item) return false;
  item.resolved = true;
  item.resolvedBy = role;
  item.resolvedAt = new Date().toISOString();
  if (extra.note) item.resolvedNote = extra.note;
  if (extra.fixedAdId) item.fixedAdId = extra.fixedAdId;
  await client.set(feedbackKey(adId), list);
  return true;
}
