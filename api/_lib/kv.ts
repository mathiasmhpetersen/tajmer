import { Redis } from "@upstash/redis";
import type { PreviewFeedbackItem, Role } from "../../shared/types.js";

/** Thrown when a write is attempted but no KV/Redis is configured yet. */
export class KVError extends Error {
  constructor(message = "Lager (KV) er ikke konfigureret på serveren") {
    super(message);
    this.name = "KVError";
  }
}

let cached: Redis | null | undefined;

/**
 * Reads whichever credential pair Vercel provisioned — the Vercel KV names
 * (`KV_REST_API_*`) or the Upstash marketplace names (`UPSTASH_REDIS_REST_*`).
 * Returns null when neither is set so reads can degrade gracefully.
 */
function kv(): Redis | null {
  if (cached !== undefined) return cached;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  cached = url && token ? new Redis({ url, token }) : null;
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
): Promise<PreviewFeedbackItem> {
  const client = requireKv();
  const list = (await client.get<PreviewFeedbackItem[]>(feedbackKey(adId))) ?? [];
  const item: PreviewFeedbackItem = {
    id: crypto.randomUUID(),
    text,
    role,
    createdAt: new Date().toISOString(),
    resolved: false,
  };
  list.push(item);
  await client.set(feedbackKey(adId), list);
  // A correction removes any standing approval (§3).
  await client.del(approvalKey(adId, creativeId));
  return item;
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
