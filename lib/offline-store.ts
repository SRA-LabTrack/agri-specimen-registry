import type { PhotoMap, SpecimenRow } from "./types";
import type { SpecimenData } from "./specimen-fields";

const DB_NAME = "agrispecimen-offline";
const DB_VERSION = 1;
const META_STORE = "meta";
const MUTATION_STORE = "mutations";
const PHOTO_STORE = "photos";

export const OFFLINE_PHOTO_PREFIX = "offline-photo-";
export const MAX_PENDING_MUTATIONS = 40;
export const MAX_PENDING_PHOTO_BYTES = 24 * 1024 * 1024;
const MAX_CACHED_PHOTO_BYTES = 75 * 1024 * 1024;

export type SessionUser = {
  $id: string;
  name: string;
  email: string;
};

export type OfflineStatus = "pending-create" | "pending-update";

export type QueuedPhoto = {
  cacheId: string;
  name: string;
  type: string;
  size: number;
};

export type OfflineMutation = {
  id: string;
  userId: string;
  kind: "create" | "update" | "delete";
  targetId: string;
  queuedAt: string;
  creator: { id: string; name: string; email: string };
  formData?: SpecimenData;
  photoMap?: PhotoMap;
  localPhotos?: Record<string, QueuedPhoto>;
  deleteFileIds?: string[];
  rowSnapshot?: SpecimenRow;
};

type MetaRecord = { key: string; value: unknown };
type PhotoRecord = { id: string; blob: Blob; size: number; updatedAt: number };

function hasIndexedDb(): boolean {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!hasIndexedDb()) {
      reject(new Error("Offline storage is not supported by this browser."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(META_STORE)) {
        database.createObjectStore(META_STORE, { keyPath: "key" });
      }
      if (!database.objectStoreNames.contains(MUTATION_STORE)) {
        const store = database.createObjectStore(MUTATION_STORE, { keyPath: "id" });
        store.createIndex("userId", "userId", { unique: false });
      }
      if (!database.objectStoreNames.contains(PHOTO_STORE)) {
        database.createObjectStore(PHOTO_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open offline storage."));
  });
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const request = operation(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Offline storage operation failed."));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error("Offline storage transaction failed."));
    };
  });
}

async function putMeta(key: string, value: unknown): Promise<void> {
  await withStore(META_STORE, "readwrite", (store) => store.put({ key, value } satisfies MetaRecord));
}

async function getMeta<T>(key: string): Promise<T | null> {
  const record = await withStore<MetaRecord | undefined>(META_STORE, "readonly", (store) => store.get(key));
  return (record?.value as T | undefined) ?? null;
}

async function deleteMeta(key: string): Promise<void> {
  await withStore(META_STORE, "readwrite", (store) => store.delete(key));
}

export async function cacheUser(user: SessionUser): Promise<void> {
  await putMeta("session-user", { $id: user.$id, name: user.name, email: user.email });
}

export async function getCachedUser(): Promise<SessionUser | null> {
  return getMeta<SessionUser>("session-user");
}

export async function clearCachedUser(): Promise<void> {
  await deleteMeta("session-user");
}

export async function cacheRows(userId: string, rows: SpecimenRow[]): Promise<void> {
  const limitedRows = rows.slice(0, 500);
  await putMeta(`rows:${userId}`, limitedRows);
  await putMeta(`rows-cached-at:${userId}`, new Date().toISOString());
}

export async function getCachedRows(userId: string): Promise<SpecimenRow[]> {
  return (await getMeta<SpecimenRow[]>(`rows:${userId}`)) || [];
}

export async function getRowsCachedAt(userId: string): Promise<string | null> {
  return getMeta<string>(`rows-cached-at:${userId}`);
}

export async function clearCachedRows(userId: string): Promise<void> {
  await Promise.all([deleteMeta(`rows:${userId}`), deleteMeta(`rows-cached-at:${userId}`)]);
}

export function createOfflinePhotoId(): string {
  const randomId = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${OFFLINE_PHOTO_PREFIX}${randomId}`;
}

export async function cachePhoto(id: string, blob: Blob): Promise<void> {
  const record: PhotoRecord = { id, blob, size: blob.size, updatedAt: Date.now() };
  await withStore(PHOTO_STORE, "readwrite", (store) => store.put(record));
  if (!id.startsWith(OFFLINE_PHOTO_PREFIX)) {
    void trimPhotoCache();
  }
}

export async function getCachedPhoto(id: string): Promise<Blob | null> {
  const record = await withStore<PhotoRecord | undefined>(PHOTO_STORE, "readonly", (store) => store.get(id));
  if (!record) return null;
  record.updatedAt = Date.now();
  void withStore(PHOTO_STORE, "readwrite", (store) => store.put(record));
  return record.blob;
}

export async function deleteCachedPhoto(id: string): Promise<void> {
  await withStore(PHOTO_STORE, "readwrite", (store) => store.delete(id));
}

export async function hasCachedPhoto(id: string): Promise<boolean> {
  const record = await withStore<PhotoRecord | undefined>(PHOTO_STORE, "readonly", (store) => store.get(id));
  return Boolean(record);
}

async function trimPhotoCache(): Promise<void> {
  const records = await withStore<PhotoRecord[]>(PHOTO_STORE, "readonly", (store) => store.getAll());
  const remoteRecords = records
    .filter((record) => !record.id.startsWith(OFFLINE_PHOTO_PREFIX))
    .sort((left, right) => left.updatedAt - right.updatedAt);
  let total = remoteRecords.reduce((sum, record) => sum + record.size, 0);
  for (const record of remoteRecords) {
    if (total <= MAX_CACHED_PHOTO_BYTES) break;
    await deleteCachedPhoto(record.id);
    total -= record.size;
  }
}

export async function cachePhotoFromUrl(id: string, url: string): Promise<boolean> {
  if (await hasCachedPhoto(id)) return true;
  try {
    const response = await fetch(url, { credentials: "include", cache: "no-store" });
    if (!response.ok) return false;
    const blob = await response.blob();
    if (!blob.size) return false;
    await cachePhoto(id, blob);
    return true;
  } catch {
    return false;
  }
}

export async function getPendingMutations(userId: string): Promise<OfflineMutation[]> {
  const all = await withStore<OfflineMutation[]>(MUTATION_STORE, "readonly", (store) => store.getAll());
  return all
    .filter((mutation) => mutation.userId === userId)
    .sort((left, right) => left.queuedAt.localeCompare(right.queuedAt));
}

export async function getPendingMutationCount(userId: string): Promise<number> {
  return (await getPendingMutations(userId)).length;
}

function referencedLocalPhotoIds(mutation: OfflineMutation): Set<string> {
  return new Set(
    Object.values(mutation.photoMap || {}).filter((id) => id.startsWith(OFFLINE_PHOTO_PREFIX)),
  );
}

function mergeMutation(existing: OfflineMutation, incoming: OfflineMutation): OfflineMutation | null {
  if (existing.kind === "create" && incoming.kind === "delete") return null;

  const combinedPhotos = { ...(existing.localPhotos || {}), ...(incoming.localPhotos || {}) };
  const nextKind = existing.kind === "create" ? "create" : incoming.kind;
  const merged: OfflineMutation = {
    ...existing,
    ...incoming,
    id: existing.id,
    kind: nextKind,
    queuedAt: existing.queuedAt,
    localPhotos: combinedPhotos,
    deleteFileIds: [...new Set([...(existing.deleteFileIds || []), ...(incoming.deleteFileIds || [])])],
  };

  const referenced = referencedLocalPhotoIds(merged);
  merged.localPhotos = Object.fromEntries(
    Object.entries(combinedPhotos).filter(([id]) => referenced.has(id)),
  );
  return merged;
}

function mutationPhotoBytes(mutation: OfflineMutation): number {
  return Object.values(mutation.localPhotos || {}).reduce((sum, photo) => sum + photo.size, 0);
}

export async function enqueueMutation(incoming: OfflineMutation): Promise<void> {
  const all = await withStore<OfflineMutation[]>(MUTATION_STORE, "readonly", (store) => store.getAll());
  const sameIndex = all.findIndex(
    (mutation) => mutation.userId === incoming.userId && mutation.targetId === incoming.targetId,
  );
  const previous = sameIndex >= 0 ? all[sameIndex] : null;
  const merged = previous ? mergeMutation(previous, incoming) : incoming;

  const next = sameIndex >= 0 ? all.filter((_, index) => index !== sameIndex) : [...all];
  if (merged) next.push(merged);

  const userQueue = next.filter((mutation) => mutation.userId === incoming.userId);
  const queuedBytes = userQueue.reduce((sum, mutation) => sum + mutationPhotoBytes(mutation), 0);
  if (userQueue.length > MAX_PENDING_MUTATIONS) {
    throw new Error(`Offline queue limit reached (${MAX_PENDING_MUTATIONS} changes). Connect to the internet and sync before adding more.`);
  }
  if (queuedBytes > MAX_PENDING_PHOTO_BYTES) {
    throw new Error("Offline photo queue reached 24 MB. Connect to the internet and sync before adding more photographs.");
  }

  if (previous) {
    await withStore(MUTATION_STORE, "readwrite", (store) => store.delete(previous.id));
  }
  if (merged) {
    await withStore(MUTATION_STORE, "readwrite", (store) => store.put(merged));
  }

  if (previous) {
    const stillReferenced = merged ? referencedLocalPhotoIds(merged) : new Set<string>();
    for (const id of Object.keys(previous.localPhotos || {})) {
      if (!stillReferenced.has(id)) await deleteCachedPhoto(id);
    }
  }
}

export async function removeMutation(mutation: OfflineMutation): Promise<void> {
  await withStore(MUTATION_STORE, "readwrite", (store) => store.delete(mutation.id));
  for (const id of Object.keys(mutation.localPhotos || {})) {
    await deleteCachedPhoto(id);
  }
}

export function overlayPendingMutations(rows: SpecimenRow[], mutations: OfflineMutation[]): SpecimenRow[] {
  const byId = new Map(rows.map((row) => [row.$id, row]));
  for (const mutation of mutations) {
    if (mutation.kind === "delete") {
      byId.delete(mutation.targetId);
      continue;
    }
    if (mutation.rowSnapshot) byId.set(mutation.targetId, mutation.rowSnapshot);
  }
  return [...byId.values()].sort((left, right) => right.$createdAt.localeCompare(left.$createdAt));
}

export async function clearOfflineAccountData(userId: string): Promise<void> {
  const mutations = await getPendingMutations(userId);
  for (const mutation of mutations) await removeMutation(mutation);
  await clearCachedRows(userId);
  await clearCachedUser();
}
