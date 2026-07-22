"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  BookOpenText,
  Bug,
  Camera,
  Check,
  CircleUserRound,
  Cloud,
  CloudOff,
  Edit3,
  Eye,
  FileImage,
  FileSpreadsheet,
  FileText,
  Filter,
  FlaskConical,
  ImagePlus,
  Leaf,
  ListChecks,
  LoaderCircle,
  LogOut,
  MapPin,
  Menu,
  RefreshCw,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Sprout,
  Trash2,
  UploadCloud,
  AlertTriangle,
  X,
} from "lucide-react";
import { ID, Permission, Query, Role } from "appwrite";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import {
  APPWRITE_BUCKET_ID,
  APPWRITE_DATABASE_ID,
  APPWRITE_TABLE_ID,
  account,
  appwriteConfigured,
  storage,
  tablesDB,
} from "@/lib/appwrite";
import {
  buildSearchText,
  displayScientificName,
  emptySpecimen,
  fieldGroups,
  photoSlots,
  specimenFields,
  type SpecimenData,
} from "@/lib/specimen-fields";
import { parsePhotoMap, parseSpecimenData, type PhotoMap, type SpecimenRow } from "@/lib/types";
import { parseRegistryWorkbook, type ParsedImportRow } from "@/lib/excel-import";
import { compressSpecimenImage, formatFileSize, type ImageCompressionResult } from "@/lib/image-compression";
import {
  OFFLINE_PHOTO_PREFIX,
  cachePhoto,
  cachePhotoFromUrl,
  cacheRows,
  cacheUser,
  clearOfflineAccountData,
  createOfflinePhotoId,
  enqueueMutation,
  getCachedPhoto,
  getCachedRows,
  getCachedUser,
  getPendingMutationCount,
  getPendingMutations,
  overlayPendingMutations,
  removeMutation,
  type OfflineMutation,
  type QueuedPhoto,
  type SessionUser,
} from "@/lib/offline-store";

const SAMPLE_STATUSES = ["Collected", "In examination", "Awaiting verification", "Verified", "Preserved", "Archived"];

type AuthMode = "login" | "register";
type Toast = { type: "success" | "error"; message: string } | null;
type ImportSummary = { added: number; duplicates: number; failed: number; total: number } | null;

function generateAutomaticSpecimenNo(index = 0): string {
  return `AUTO-${Date.now().toString(36).toUpperCase()}-${index.toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

function formatDate(value?: string): string {
  if (!value) return "Not provided";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-PH", { year: "numeric", month: "short", day: "numeric" }).format(date);
}

function toIsoDate(value: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function appwriteError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) return String((error as { message: unknown }).message);
  return "Something went wrong. Please try again.";
}

function safeFilename(value: string): string {
  return value.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "") || "specimen";
}

type CreatorIdentity = { id: string; name: string; email: string };

function buildRecordCore(data: SpecimenData, creator: CreatorIdentity, photos: PhotoMap) {
  return {
    specimenNo: data.specimenNo,
    speciesId: data.speciesId || "",
    verifiedId: data.verifiedId || "",
    dateCollection: toIsoDate(data.dateCollection) || null,
    dateVerification: toIsoDate(data.dateVerification) || null,
    family: data.family || "",
    genus: data.genus || "",
    species: data.species || "",
    commonName: data.commonName || "",
    sampleStatus: data.sampleStatus || "",
    conservationStatus: data.conservationStatus || "",
    taxonomicStatus: data.taxonomicStatus || "",
    createdById: creator.id,
    createdByName: creator.name,
    createdByEmail: creator.email,
    dataJson: JSON.stringify(data),
    photoJson: JSON.stringify(photos),
    searchText: buildSearchText(data, creator.name, creator.email),
  };
}

function createOfflineSnapshot(
  existing: SpecimenRow | null,
  targetId: string,
  core: ReturnType<typeof buildRecordCore>,
  status: "pending-create" | "pending-update",
): SpecimenRow {
  const now = new Date().toISOString();
  return {
    ...(existing || {}),
    ...core,
    $id: targetId,
    $createdAt: existing?.$createdAt || now,
    $updatedAt: now,
    $permissions: existing?.$permissions || [],
    $databaseId: APPWRITE_DATABASE_ID,
    $tableId: APPWRITE_TABLE_ID,
    __offlineStatus: status,
  } as SpecimenRow;
}

function remotePhotoPreview(fileId: string): string {
  return String(storage.getFilePreview({
    bucketId: APPWRITE_BUCKET_ID,
    fileId,
    width: 1400,
    height: 1000,
    quality: 88,
  }));
}

async function warmRegistryPhotoCache(rows: SpecimenRow[]): Promise<void> {
  const ids = [...new Set(rows.flatMap((row) => Object.values(parsePhotoMap(row)) as string[]))]
    .filter((id) => id && !id.startsWith(OFFLINE_PHOTO_PREFIX))
    .slice(0, 150);
  let cursor = 0;
  const workers = Array.from({ length: 3 }, async () => {
    while (cursor < ids.length) {
      const id = ids[cursor];
      cursor += 1;
      await cachePhotoFromUrl(id, remotePhotoPreview(id));
    }
  });
  await Promise.all(workers);
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: (typeof specimenFields)[number];
  value: string;
  onChange: (value: string) => void;
}) {
  const common = {
    id: field.key,
    name: field.key,
    value,
    required: field.required,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => onChange(event.target.value),
  };

  if (field.type === "textarea") {
    return <textarea {...common} rows={3} placeholder={field.placeholder} />;
  }

  if (field.type === "select") {
    const hasImportedValue = Boolean(value) && !field.options?.includes(value);
    return (
      <select {...common}>
        <option value="">Select an option</option>
        {hasImportedValue && <option value={value}>{value} (imported value)</option>}
        {field.options?.map((option) => <option key={option}>{option}</option>)}
      </select>
    );
  }

  return <input {...common} type={field.type} step={field.step} placeholder={field.placeholder} />;
}

function PhotoImage({ fileId, alt, className = "" }: { fileId: string; alt: string; className?: string }) {
  const isLocal = fileId.startsWith(OFFLINE_PHOTO_PREFIX);
  const [src, setSrc] = useState(isLocal ? "" : remotePhotoPreview(fileId));

  useEffect(() => {
    let objectUrl = "";
    let cancelled = false;
    const useCached = async () => {
      const blob = await getCachedPhoto(fileId);
      if (!blob || cancelled) return;
      objectUrl = URL.createObjectURL(blob);
      setSrc(objectUrl);
    };

    if (isLocal || !navigator.onLine) void useCached();
    else void cachePhotoFromUrl(fileId, remotePhotoPreview(fileId));

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileId, isLocal]);

  if (!src) return <div className="offline-photo-loading"><Camera /><span>Cached photo</span></div>;
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      crossOrigin={isLocal ? undefined : "anonymous"}
      onError={() => { void getCachedPhoto(fileId).then((blob) => { if (blob) setSrc(URL.createObjectURL(blob)); }); }}
    />
  );
}

export default function Home() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(appwriteConfigured);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [rows, setRows] = useState<SpecimenRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [search, setSearch] = useState("");
  const [filterField, setFilterField] = useState("all");
  const [filterValue, setFilterValue] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [detailsRow, setDetailsRow] = useState<SpecimenRow | null>(null);
  const [editingRow, setEditingRow] = useState<SpecimenRow | null>(null);
  const [formData, setFormData] = useState<SpecimenData>(emptySpecimen());
  const [photoFiles, setPhotoFiles] = useState<Record<string, File | undefined>>({});
  const [photoCompressionInfo, setPhotoCompressionInfo] = useState<Record<string, ImageCompressionResult | undefined>>({});
  const [compressingPhotoSlots, setCompressingPhotoSlots] = useState<Record<string, boolean>>({});
  const [existingPhotos, setExistingPhotos] = useState<PhotoMap>({});
  const [removedPhotoIds, setRemovedPhotoIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importFileName, setImportFileName] = useState("");
  const [importRows, setImportRows] = useState<ParsedImportRow[]>([]);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [importBusy, setImportBusy] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [importSummary, setImportSummary] = useState<ImportSummary>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const syncBusyRef = useRef(false);
  const photoCompressionBusy = Object.values(compressingPhotoSlots).some(Boolean);

  const showToast = (next: Toast) => {
    setToast(next);
    window.setTimeout(() => setToast(null), 4200);
  };

  const refreshPendingCount = async (userId: string) => {
    setPendingCount(await getPendingMutationCount(userId));
  };

  const loadRows = async (activeUserId = user?.$id, quiet = false) => {
    if (!appwriteConfigured || !activeUserId) return;
    setLoadingRows(true);
    const cached = await getCachedRows(activeUserId);
    const pending = await getPendingMutations(activeUserId);
    if (cached.length) setRows(overlayPendingMutations(cached, pending));
    setPendingCount(pending.length);

    if (!navigator.onLine) {
      setLoadingRows(false);
      return;
    }

    try {
      const response = await tablesDB.listRows({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_TABLE_ID,
        queries: [Query.orderDesc("$createdAt"), Query.limit(500)],
        total: true,
        ttl: 0,
      });
      const remoteRows = response.rows as unknown as SpecimenRow[];
      const combined = overlayPendingMutations(remoteRows, pending);
      setRows(combined);
      await cacheRows(activeUserId, combined);
      void warmRegistryPhotoCache(remoteRows);
    } catch (error) {
      if (!cached.length && !quiet) {
        showToast({ type: "error", message: `Could not load specimens: ${appwriteError(error)}` });
      }
    } finally {
      setLoadingRows(false);
    }
  };

  const syncPendingChanges = async (activeUser = user) => {
    if (!activeUser || !navigator.onLine || syncBusyRef.current) return;
    syncBusyRef.current = true;
    setSyncing(true);
    let synced = 0;
    let failed = 0;

    try {
      const mutations = await getPendingMutations(activeUser.$id);
      setPendingCount(mutations.length);

      for (const mutation of mutations) {
        try {
          if (mutation.kind === "delete") {
            try {
              await tablesDB.deleteRow({
                databaseId: APPWRITE_DATABASE_ID,
                tableId: APPWRITE_TABLE_ID,
                rowId: mutation.targetId,
              });
            } catch (error) {
              const code = (error as { code?: number })?.code;
              if (code !== 404) throw error;
            }
          } else {
            const finalPhotos: PhotoMap = { ...(mutation.photoMap || {}) };
            for (const [slot, fileId] of Object.entries(finalPhotos) as [string, string][]) {
              if (!fileId.startsWith(OFFLINE_PHOTO_PREFIX)) continue;
              const queued = mutation.localPhotos?.[fileId];
              const blob = await getCachedPhoto(fileId);
              if (!queued || !blob) throw new Error(`Queued photo for ${slot} is missing from this browser.`);
              const file = new File([blob], queued.name, { type: queued.type || blob.type || "image/webp" });
              const uploaded = await storage.createFile({
                bucketId: APPWRITE_BUCKET_ID,
                fileId: ID.unique(),
                file,
                permissions: [
                  Permission.read(Role.users()),
                  Permission.update(Role.user(mutation.creator.id)),
                  Permission.delete(Role.user(mutation.creator.id)),
                ],
              });
              finalPhotos[slot] = uploaded.$id;
              await cachePhoto(uploaded.$id, blob);
            }

            const core = buildRecordCore(
              mutation.formData || emptySpecimen(),
              mutation.creator,
              finalPhotos,
            );

            if (mutation.kind === "create") {
              await tablesDB.createRow({
                databaseId: APPWRITE_DATABASE_ID,
                tableId: APPWRITE_TABLE_ID,
                rowId: ID.unique(),
                data: core,
                permissions: [
                  Permission.read(Role.users()),
                  Permission.update(Role.user(mutation.creator.id)),
                  Permission.delete(Role.user(mutation.creator.id)),
                ],
              });
            } else {
              await tablesDB.updateRow({
                databaseId: APPWRITE_DATABASE_ID,
                tableId: APPWRITE_TABLE_ID,
                rowId: mutation.targetId,
                data: core,
              });
            }
          }

          const remotePhotosToDelete = (mutation.deleteFileIds || [])
            .filter((id) => id && !id.startsWith(OFFLINE_PHOTO_PREFIX));
          await Promise.allSettled(
            remotePhotosToDelete.map((fileId) => storage.deleteFile({ bucketId: APPWRITE_BUCKET_ID, fileId })),
          );
          await removeMutation(mutation);
          synced += 1;
          setPendingCount(await getPendingMutationCount(activeUser.$id));
        } catch {
          failed += 1;
        }
      }

      await loadRows(activeUser.$id, true);
      if (synced > 0) {
        showToast({
          type: failed ? "error" : "success",
          message: failed
            ? `${synced} offline change${synced === 1 ? "" : "s"} synced; ${failed} still waiting.`
            : `${synced} offline change${synced === 1 ? "" : "s"} synced to Appwrite.`,
        });
      }
    } finally {
      await refreshPendingCount(activeUser.$id);
      setSyncing(false);
      syncBusyRef.current = false;
    }
  };

  useEffect(() => {
    if (!appwriteConfigured) return;
    let cancelled = false;

    const boot = async () => {
      setIsOnline(navigator.onLine);
      const cachedUser = await getCachedUser();
      if (cachedUser && !cancelled) {
        setUser(cachedUser);
        const cachedRows = await getCachedRows(cachedUser.$id);
        const pending = await getPendingMutations(cachedUser.$id);
        setRows(overlayPendingMutations(cachedRows, pending));
        setPendingCount(pending.length);
      }

      if (!navigator.onLine) {
        setCheckingSession(false);
        return;
      }

      try {
        const current = await account.get();
        const sessionUser: SessionUser = { $id: current.$id, name: current.name, email: current.email };
        if (cancelled) return;
        setUser(sessionUser);
        await cacheUser(sessionUser);
        await loadRows(sessionUser.$id, true);
        await syncPendingChanges(sessionUser);
      } catch (error) {
        const code = (error as { code?: number })?.code;
        // An expired online session must return to the sign-in screen, but the
        // cached registry and queued changes stay in IndexedDB for that account.
        if (code === 401 || !cachedUser) setUser(null);
      } finally {
        if (!cancelled) setCheckingSession(false);
      }
    };

    void boot();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (user) void syncPendingChanges(user);
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    setIsOnline(navigator.onLine);
    if (user) void refreshPendingCount(user.$id);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [user?.$id]);

  const filteredRows = useMemo(() => {
    const globalNeedle = search.trim().toLowerCase();
    const fieldNeedle = filterValue.trim().toLowerCase();
    return rows.filter((row) => {
      const data = parseSpecimenData(row);
      const globalMatch = !globalNeedle || row.searchText?.includes(globalNeedle);
      const fieldMatch = !fieldNeedle || filterField === "all"
        ? true
        : String(data[filterField] || "").toLowerCase().includes(fieldNeedle);
      return globalMatch && fieldMatch;
    });
  }, [rows, search, filterField, filterValue]);

  const importPlan = useMemo(() => {
    const existing = new Set(rows.map((row) => row.specimenNo.trim().toLowerCase()).filter(Boolean));
    const seen = new Set<string>();
    let duplicates = 0;
    let generatedIds = 0;
    let importable = 0;

    for (const item of importRows) {
      const specimenNo = item.data.specimenNo.trim();
      if (!specimenNo) {
        generatedIds += 1;
        importable += 1;
        continue;
      }
      const normalized = specimenNo.toLowerCase();
      if (existing.has(normalized) || seen.has(normalized)) {
        duplicates += 1;
        continue;
      }
      seen.add(normalized);
      importable += 1;
    }

    return { importable, duplicates, generatedIds, total: importRows.length };
  }, [importRows, rows]);

  useEffect(() => {
    const elements = document.querySelectorAll<HTMLElement>(".reveal");

    // Keep content visible when a browser blocks or does not support
    // IntersectionObserver. This prevents invisible but clickable cards.
    if (!("IntersectionObserver" in window)) {
      elements.forEach((element) => {
        element.classList.remove("is-hidden");
        element.classList.add("is-visible");
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          entry.target.classList.toggle("is-visible", entry.isIntersecting);
          entry.target.classList.toggle("is-hidden", !entry.isIntersecting);
        });
      },
      { threshold: 0.08, rootMargin: "40px 0px -20px 0px" },
    );

    elements.forEach((element) => {
      const bounds = element.getBoundingClientRect();
      const initiallyVisible = bounds.bottom >= 0 && bounds.top <= window.innerHeight;
      element.classList.toggle("is-visible", initiallyVisible);
      element.classList.toggle("is-hidden", !initiallyVisible);
      observer.observe(element);
    });

    return () => observer.disconnect();
  }, [filteredRows.length, user, formOpen, detailsRow, importOpen]);

  const handleAuth = async (event: FormEvent) => {
    event.preventDefault();
    if (!navigator.onLine) {
      showToast({ type: "error", message: "An internet connection is required for the first sign-in. After that, this browser can reopen the registry offline." });
      return;
    }
    setAuthBusy(true);
    try {
      if (authMode === "register") {
        await account.create({ userId: ID.unique(), email: authEmail.trim(), password: authPassword, name: authName.trim() });
      }
      await account.createEmailPasswordSession({ email: authEmail.trim(), password: authPassword });
      const current = await account.get();
      const sessionUser: SessionUser = { $id: current.$id, name: current.name, email: current.email };
      setUser(sessionUser);
      await cacheUser(sessionUser);
      await loadRows(sessionUser.$id);
      await syncPendingChanges(sessionUser);
      setAuthPassword("");
      showToast({ type: "success", message: authMode === "register" ? "Account created and offline copy prepared." : "Welcome back. Offline copy refreshed." });
    } catch (error) {
      showToast({ type: "error", message: appwriteError(error) });
    } finally {
      setAuthBusy(false);
    }
  };

  const logout = async () => {
    if (!user) return;
    if (pendingCount > 0 && !window.confirm(`You have ${pendingCount} unsynced change${pendingCount === 1 ? "" : "s"}. Logging out will remove them from this browser. Continue?`)) return;
    try {
      if (navigator.onLine) await account.deleteSession({ sessionId: "current" });
    } finally {
      try {
        await clearOfflineAccountData(user.$id);
      } catch {
        // Logging out should still complete even when browser storage cleanup fails.
      }
      setUser(null);
      setRows([]);
      setPendingCount(0);
      setMenuOpen(false);
    }
  };

  const openNewForm = () => {
    setEditingRow(null);
    setFormData(emptySpecimen());
    setPhotoFiles({});
    setPhotoCompressionInfo({});
    setCompressingPhotoSlots({});
    setExistingPhotos({});
    setRemovedPhotoIds([]);
    setFormOpen(true);
  };

  const openEditForm = (row: SpecimenRow) => {
    setEditingRow(row);
    setFormData({ ...emptySpecimen(), ...parseSpecimenData(row) });
    setPhotoFiles({});
    setPhotoCompressionInfo({});
    setCompressingPhotoSlots({});
    setExistingPhotos(parsePhotoMap(row));
    setRemovedPhotoIds([]);
    setDetailsRow(null);
    setFormOpen(true);
  };

  const removePhotoSlot = (slotKey: string) => {
    const existingId = existingPhotos[slotKey];
    if (existingId) {
      setRemovedPhotoIds((current) => current.includes(existingId) ? current : [...current, existingId]);
    }
    setExistingPhotos((current) => {
      const next = { ...current };
      delete next[slotKey];
      return next;
    });
    setPhotoFiles((current) => ({ ...current, [slotKey]: undefined }));
    setPhotoCompressionInfo((current) => ({ ...current, [slotKey]: undefined }));
  };

  const selectPhotoForSlot = async (slotKey: string, file?: File) => {
    if (!file) return;
    setCompressingPhotoSlots((current) => ({ ...current, [slotKey]: true }));
    setPhotoCompressionInfo((current) => ({ ...current, [slotKey]: undefined }));
    try {
      const result = await compressSpecimenImage(file);
      setPhotoFiles((current) => ({ ...current, [slotKey]: result.file }));
      setPhotoCompressionInfo((current) => ({ ...current, [slotKey]: result }));
    } catch (error) {
      // Preserve usability: use the original image when browser-side compression fails.
      setPhotoFiles((current) => ({ ...current, [slotKey]: file }));
      showToast({ type: "error", message: `Photo compression failed, so the original file will be used: ${appwriteError(error)}` });
    } finally {
      setCompressingPhotoSlots((current) => ({ ...current, [slotKey]: false }));
    }
  };

  const openImportModal = () => {
    if (!isOnline) {
      showToast({ type: "error", message: "Excel bulk import is available online only. Manual specimen additions and edits can still be queued offline." });
      return;
    }
    setImportFileName("");
    setImportRows([]);
    setImportWarnings([]);
    setImportProgress({ current: 0, total: 0 });
    setImportSummary(null);
    setImportOpen(true);
  };

  const analyzeImportFile = async (file?: File) => {
    if (!file) return;
    setImportBusy(true);
    setImportFileName(file.name);
    setImportRows([]);
    setImportWarnings([]);
    setImportSummary(null);
    try {
      const analysis = await parseRegistryWorkbook(file);
      setImportRows(analysis.rows);
      setImportWarnings(analysis.warnings);
      if (analysis.rows.length) {
        showToast({ type: "success", message: `${analysis.rows.length} spreadsheet row${analysis.rows.length === 1 ? "" : "s"} ready for review.` });
      }
    } catch (error) {
      setImportWarnings([`Could not read the Excel file: ${appwriteError(error)}`]);
    } finally {
      setImportBusy(false);
    }
  };

  const importExcelRows = async () => {
    if (!user || !importRows.length) return;
    setImportBusy(true);
    setImportSummary(null);
    setImportProgress({ current: 0, total: importRows.length });

    const existing = new Set(rows.map((row) => row.specimenNo.trim().toLowerCase()).filter(Boolean));
    const seen = new Set<string>();
    let added = 0;
    let duplicates = 0;
    let failed = 0;

    for (let index = 0; index < importRows.length; index += 1) {
      const item = importRows[index];
      const data = { ...emptySpecimen(), ...item.data };
      const enteredSpecimenNo = data.specimenNo.trim();
      const storedSpecimenNo = enteredSpecimenNo || generateAutomaticSpecimenNo(index);
      const normalized = storedSpecimenNo.toLowerCase();

      if (existing.has(normalized) || seen.has(normalized)) {
        duplicates += 1;
        setImportProgress({ current: index + 1, total: importRows.length });
        continue;
      }

      data.specimenNo = storedSpecimenNo;
      const core = buildRecordCore(data, { id: user.$id, name: user.name || user.email, email: user.email }, {});

      try {
        await tablesDB.createRow({
          databaseId: APPWRITE_DATABASE_ID,
          tableId: APPWRITE_TABLE_ID,
          rowId: ID.unique(),
          data: core,
          permissions: [
            Permission.read(Role.users()),
            Permission.update(Role.user(user.$id)),
            Permission.delete(Role.user(user.$id)),
          ],
        });
        seen.add(normalized);
        added += 1;
      } catch (error) {
        const message = appwriteError(error);
        if (/unique|duplicate|already exists/i.test(message)) duplicates += 1;
        else failed += 1;
      }

      setImportProgress({ current: index + 1, total: importRows.length });
    }

    const summary = { added, duplicates, failed, total: importRows.length };
    setImportSummary(summary);
    await loadRows(user.$id);
    showToast({
      type: failed ? "error" : "success",
      message: `Excel import finished: ${added} added, ${duplicates} duplicate${duplicates === 1 ? "" : "s"} skipped${failed ? `, ${failed} failed` : ""}.`,
    });
    setImportBusy(false);
  };

  const queueCurrentSave = async (enteredSpecimenNo: string) => {
    if (!user) return;
    setSaving(true);
    try {
      const finalPhotos: PhotoMap = { ...existingPhotos };
      const localPhotos: Record<string, QueuedPhoto> = {};
      const filesToDelete = new Set(removedPhotoIds);

      for (const slot of photoSlots) {
        const file = photoFiles[slot.key];
        if (!file) continue;
        const previousFileId = finalPhotos[slot.key];
        if (previousFileId) filesToDelete.add(previousFileId);
        const localPhotoId = createOfflinePhotoId();
        await cachePhoto(localPhotoId, file);
        localPhotos[localPhotoId] = {
          cacheId: localPhotoId,
          name: file.name || `${slot.key}.webp`,
          type: file.type || "image/webp",
          size: file.size,
        };
        finalPhotos[slot.key] = localPhotoId;
      }

      const storedSpecimenNo = enteredSpecimenNo || generateAutomaticSpecimenNo();
      const savedFormData = { ...formData, specimenNo: storedSpecimenNo };
      const creator = {
        id: editingRow?.createdById || user.$id,
        name: editingRow?.createdByName || user.name || user.email,
        email: editingRow?.createdByEmail || user.email,
      };
      const targetId = editingRow?.$id || `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const status = editingRow ? "pending-update" : "pending-create";
      const core = buildRecordCore(savedFormData, creator, finalPhotos);
      const snapshot = createOfflineSnapshot(editingRow, targetId, core, status);
      const mutation: OfflineMutation = {
        id: `mutation-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        userId: user.$id,
        kind: editingRow ? "update" : "create",
        targetId,
        queuedAt: new Date().toISOString(),
        creator,
        formData: savedFormData,
        photoMap: finalPhotos,
        localPhotos,
        deleteFileIds: [...filesToDelete],
        rowSnapshot: snapshot,
      };

      await enqueueMutation(mutation);
      const nextRows = editingRow
        ? rows.map((row) => row.$id === editingRow.$id ? snapshot : row)
        : [snapshot, ...rows];
      setRows(nextRows);
      await cacheRows(user.$id, nextRows);
      await refreshPendingCount(user.$id);
      setFormOpen(false);
      showToast({
        type: "success",
        message: isOnline
          ? "Change queued and syncing to Appwrite."
          : "Saved on this device. It will sync automatically when internet returns.",
      });
      if (isOnline) void syncPendingChanges(user);
    } catch (error) {
      showToast({ type: "error", message: `Could not queue offline change: ${appwriteError(error)}` });
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;
    if (photoCompressionBusy) {
      showToast({ type: "error", message: "Please wait for photo compression to finish before saving." });
      return;
    }

    const enteredSpecimenNo = formData.specimenNo.trim();
    const normalizedSpecimenNo = enteredSpecimenNo.toLowerCase();
    const duplicate = enteredSpecimenNo
      ? rows.find((row) =>
          row.$id !== editingRow?.$id
          && row.specimenNo.trim().toLowerCase() === normalizedSpecimenNo,
        )
      : undefined;

    if (duplicate) {
      showToast({
        type: "error",
        message: `Specimen ${duplicate.specimenNo} already exists. Open the existing entry instead of adding a duplicate.`,
      });
      return;
    }

    if (!isOnline || editingRow?.__offlineStatus) {
      await queueCurrentSave(enteredSpecimenNo);
      return;
    }

    setSaving(true);
    try {
      const uploaded: PhotoMap = { ...existingPhotos };
      const filesToDelete = new Set(removedPhotoIds);
      for (const slot of photoSlots) {
        const file = photoFiles[slot.key];
        if (!file) continue;
        const previousFileId = uploaded[slot.key];
        if (previousFileId) filesToDelete.add(previousFileId);
        const result = await storage.createFile({
          bucketId: APPWRITE_BUCKET_ID,
          fileId: ID.unique(),
          file,
          permissions: [
            Permission.read(Role.users()),
            Permission.update(Role.user(user.$id)),
            Permission.delete(Role.user(user.$id)),
          ],
        });
        uploaded[slot.key] = result.$id;
        await cachePhoto(result.$id, file);
      }

      const generatedSpecimenNo = generateAutomaticSpecimenNo();
      const storedSpecimenNo = enteredSpecimenNo || generatedSpecimenNo;
      const savedFormData = { ...formData, specimenNo: storedSpecimenNo };
      const creator = {
        id: editingRow?.createdById || user.$id,
        name: editingRow?.createdByName || user.name || user.email,
        email: editingRow?.createdByEmail || user.email,
      };
      const core = buildRecordCore(savedFormData, creator, uploaded);

      let successMessage: string;
      if (editingRow) {
        await tablesDB.updateRow({
          databaseId: APPWRITE_DATABASE_ID,
          tableId: APPWRITE_TABLE_ID,
          rowId: editingRow.$id,
          data: core,
        });
        successMessage = "Every specimen field and photo change was saved.";
      } else {
        await tablesDB.createRow({
          databaseId: APPWRITE_DATABASE_ID,
          tableId: APPWRITE_TABLE_ID,
          rowId: ID.unique(),
          data: core,
          permissions: [
            Permission.read(Role.users()),
            Permission.update(Role.user(user.$id)),
            Permission.delete(Role.user(user.$id)),
          ],
        });
        successMessage = "Specimen added to the registry.";
      }

      const deletionResults = await Promise.allSettled(
        [...filesToDelete].map((fileId) => storage.deleteFile({ bucketId: APPWRITE_BUCKET_ID, fileId })),
      );
      if (deletionResults.some((result) => result.status === "rejected")) {
        successMessage += " The record was saved, but one old photo could not be removed from storage.";
      }

      showToast({ type: "success", message: successMessage });
      setFormOpen(false);
      await loadRows(user.$id);
    } catch (error) {
      const message = appwriteError(error);
      const isDuplicate = /unique|duplicate|already exists/i.test(message);
      showToast({
        type: "error",
        message: isDuplicate
          ? `Specimen ${enteredSpecimenNo || "with this generated ID"} already exists in the registry.`
          : `Could not save: ${message}`,
      });
    } finally {
      setSaving(false);
    }
  };

  const quickStatus = async (row: SpecimenRow, status: string) => {
    if (!user || row.createdById !== user.$id) return;
    const data = { ...parseSpecimenData(row), sampleStatus: status };
    const creator = { id: row.createdById, name: row.createdByName, email: row.createdByEmail };

    if (!isOnline || row.__offlineStatus) {
      try {
        const core = buildRecordCore(data, creator, parsePhotoMap(row));
        const snapshot = createOfflineSnapshot(row, row.$id, core, row.__offlineStatus || "pending-update");
        const mutation: OfflineMutation = {
          id: `mutation-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          userId: user.$id,
          kind: "update",
          targetId: row.$id,
          queuedAt: new Date().toISOString(),
          creator,
          formData: data,
          photoMap: parsePhotoMap(row),
          rowSnapshot: snapshot,
        };
        await enqueueMutation(mutation);
        const nextRows = rows.map((item) => item.$id === row.$id ? snapshot : item);
        setRows(nextRows);
        await cacheRows(user.$id, nextRows);
        await refreshPendingCount(user.$id);
        if (detailsRow?.$id === row.$id) setDetailsRow(snapshot);
        showToast({ type: "success", message: isOnline ? "Status queued for sync." : `Status saved offline as ${status}.` });
        if (isOnline) void syncPendingChanges(user);
      } catch (error) {
        showToast({ type: "error", message: appwriteError(error) });
      }
      return;
    }

    try {
      await tablesDB.updateRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_TABLE_ID,
        rowId: row.$id,
        data: {
          sampleStatus: status,
          dataJson: JSON.stringify(data),
          searchText: buildSearchText(data, row.createdByName, row.createdByEmail),
        },
      });
      const nextRows = rows.map((item) => item.$id === row.$id ? { ...item, sampleStatus: status, dataJson: JSON.stringify(data), $updatedAt: new Date().toISOString() } : item);
      setRows(nextRows);
      await cacheRows(user.$id, nextRows);
      if (detailsRow?.$id === row.$id) setDetailsRow({ ...detailsRow, sampleStatus: status, dataJson: JSON.stringify(data) });
      showToast({ type: "success", message: `Status changed to ${status}.` });
    } catch (error) {
      showToast({ type: "error", message: appwriteError(error) });
    }
  };

  const deleteRow = async (row: SpecimenRow) => {
    if (!user || row.createdById !== user.$id) return;
    if (!window.confirm(`Delete specimen ${row.specimenNo}? This cannot be undone after synchronization.`)) return;
    const photoIds = Object.values(parsePhotoMap(row)) as string[];

    if (!isOnline || row.__offlineStatus) {
      try {
        await enqueueMutation({
          id: `mutation-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          userId: user.$id,
          kind: "delete",
          targetId: row.$id,
          queuedAt: new Date().toISOString(),
          creator: { id: row.createdById, name: row.createdByName, email: row.createdByEmail },
          deleteFileIds: photoIds,
        });
        const nextRows = rows.filter((item) => item.$id !== row.$id);
        setRows(nextRows);
        await cacheRows(user.$id, nextRows);
        await refreshPendingCount(user.$id);
        setDetailsRow(null);
        showToast({ type: "success", message: isOnline ? "Deletion queued for sync." : "Deletion saved offline and will sync automatically." });
        if (isOnline) void syncPendingChanges(user);
      } catch (error) {
        showToast({ type: "error", message: appwriteError(error) });
      }
      return;
    }

    try {
      await tablesDB.deleteRow({ databaseId: APPWRITE_DATABASE_ID, tableId: APPWRITE_TABLE_ID, rowId: row.$id });
      await Promise.allSettled(
        photoIds
          .filter((fileId) => !fileId.startsWith(OFFLINE_PHOTO_PREFIX))
          .map((fileId) => storage.deleteFile({ bucketId: APPWRITE_BUCKET_ID, fileId })),
      );
      const nextRows = rows.filter((item) => item.$id !== row.$id);
      setRows(nextRows);
      await cacheRows(user.$id, nextRows);
      setDetailsRow(null);
      showToast({ type: "success", message: "Specimen record and its photographs were deleted." });
    } catch (error) {
      showToast({ type: "error", message: appwriteError(error) });
    }
  };

  const captureExport = async () => {
    if (!exportRef.current) throw new Error("Export layout is not ready.");
    return html2canvas(exportRef.current, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: "#f4f1e6",
      logging: false,
      windowWidth: 1100,
    });
  };

  const exportJpeg = async () => {
    if (!detailsRow) return;
    try {
      const canvas = await captureExport();
      const anchor = document.createElement("a");
      anchor.download = `${safeFilename(detailsRow.specimenNo)}-record.jpg`;
      anchor.href = canvas.toDataURL("image/jpeg", 0.94);
      anchor.click();
    } catch (error) {
      showToast({ type: "error", message: `JPEG export failed: ${appwriteError(error)}` });
    }
  };

  const exportPdf = async () => {
    if (!detailsRow) return;
    try {
      const canvas = await captureExport();
      const image = canvas.toDataURL("image/jpeg", 0.92);
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 8;
      const imageWidth = pageWidth - margin * 2;
      const imageHeight = (canvas.height * imageWidth) / canvas.width;
      let remaining = imageHeight;
      let position = margin;
      pdf.addImage(image, "JPEG", margin, position, imageWidth, imageHeight);
      remaining -= pageHeight - margin * 2;
      while (remaining > 0) {
        position = remaining - imageHeight + margin;
        pdf.addPage();
        pdf.addImage(image, "JPEG", margin, position, imageWidth, imageHeight);
        remaining -= pageHeight - margin * 2;
      }
      pdf.save(`${safeFilename(detailsRow.specimenNo)}-record.pdf`);
    } catch (error) {
      showToast({ type: "error", message: `PDF export failed: ${appwriteError(error)}` });
    }
  };

  const downloadPhotos = async (row: SpecimenRow) => {
    const photos = Object.entries(parsePhotoMap(row)) as [string, string][];
    if (!photos.length) {
      showToast({ type: "error", message: "This record has no uploaded photographs." });
      return;
    }

    let unavailable = 0;
    for (const [slot, fileId] of photos) {
      const cached = await getCachedPhoto(fileId);
      const anchor = document.createElement("a");
      anchor.download = `${safeFilename(row.specimenNo)}-${slot}`;
      if (cached) {
        const objectUrl = URL.createObjectURL(cached);
        anchor.href = objectUrl;
        anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
      } else if (navigator.onLine && !fileId.startsWith(OFFLINE_PHOTO_PREFIX)) {
        anchor.href = String(storage.getFileDownload({ bucketId: APPWRITE_BUCKET_ID, fileId }));
        anchor.target = "_blank";
        anchor.click();
      } else {
        unavailable += 1;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 180));
    }

    if (unavailable) {
      showToast({ type: "error", message: `${unavailable} photo${unavailable === 1 ? " is" : "s are"} not available in the offline cache yet.` });
    }
  };

  if (checkingSession) {
    return <main className="center-screen"><LoaderCircle className="spin" size={42} /><p>Opening the specimen registry…</p></main>;
  }

  if (!appwriteConfigured) {
    return (
      <main className="center-screen setup-screen">
        <div className="glass setup-card">
          <Sprout size={54} />
          <h1>Connect Appwrite first</h1>
          <p>Copy <code>.env.example</code> to <code>.env.local</code>, paste your Appwrite endpoint and project ID, then restart <code>npm run dev</code>.</p>
          <p>The full beginner setup is inside <strong>README.md</strong>.</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="auth-page">
        <div className="field-glow field-glow-one" />
        <div className="field-glow field-glow-two" />
        <section className="auth-intro reveal is-visible">
          <div className="brand-mark auth-brand">
            <Leaf />
            <span className="topbar-brand-copy">
              <strong>AgriSpecimen</strong>
              <small>Powered by Luntian</small>
            </span>
          </div>
          <p className="eyebrow">Agricultural biodiversity registry</p>
          <h1>Preserve every field discovery with clarity.</h1>
          <p>Record specimen taxonomy, collection data, verification history, photographs, ecological relationships, and contributor identity in one searchable place.</p>
          <div className="feature-pills">
            <span><ShieldCheck size={17} /> Accountable records</span>
            <span><Search size={17} /> Search every field</span>
            <span><Camera size={17} /> Multi-view photos</span>
          </div>
        </section>
        <section className="glass auth-card reveal is-visible">
          <div className="auth-tabs">
            <button className={authMode === "login" ? "active" : ""} onClick={() => setAuthMode("login")}>Sign in</button>
            <button className={authMode === "register" ? "active" : ""} onClick={() => setAuthMode("register")}>Create account</button>
          </div>
          <div className="auth-heading">
            <FlaskConical />
            <div><h2>{authMode === "login" ? "Welcome back" : "Create your account"}</h2><p>No admin role—every contributor uses a standard account.</p></div>
          </div>
          {!isOnline && <div className="offline-auth-notice"><CloudOff /><span>Offline. A first-time sign-in or account creation requires internet.</span></div>}
          <form onSubmit={handleAuth} className="auth-form">
            {authMode === "register" && <label>Full name<input value={authName} onChange={(e) => setAuthName(e.target.value)} required placeholder="Your complete name" /></label>}
            <label>Email address<input type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} required placeholder="name@example.com" /></label>
            <label>Password<input type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} required minLength={8} placeholder="At least 8 characters" /></label>
            <button className="primary-button full" disabled={authBusy}>{authBusy ? <LoaderCircle className="spin" /> : authMode === "login" ? <CircleUserRound /> : <Sprout />}{authBusy ? "Please wait…" : authMode === "login" ? "Sign in" : "Register and continue"}</button>
          </form>
        </section>
        {toast && <div className={`toast ${toast.type}`}>{toast.type === "success" ? <Check /> : <X />}{toast.message}</div>}
      </main>
    );
  }

  const verifiedCount = rows.filter((row) => row.sampleStatus === "Verified").length;
  const withPhotosCount = rows.filter((row) => Object.keys(parsePhotoMap(row)).length > 0).length;
  const uniqueFamilies = new Set(rows.map((row) => row.family).filter(Boolean)).size;

  return (
    <main className="dashboard-shell">
      <div className="field-glow field-glow-one" />
      <div className="field-glow field-glow-two" />
      <header className="glass topbar">
        <button
          className="brand-mark compact topbar-brand"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="AgriSpecimen — Powered by Luntian"
        >
          <Leaf />
          <span className="topbar-brand-copy">
            <strong>AgriSpecimen</strong>
            <small>Powered by Luntian</small>
          </span>
        </button>
        <nav className={menuOpen ? "nav-actions open" : "nav-actions"}>
          <button className="ghost-button" onClick={() => document.getElementById("registry")?.scrollIntoView({ behavior: "smooth" })}><BookOpenText /> Registry</button>
          <button className="ghost-button" onClick={openImportModal}><FileSpreadsheet /> Import Excel</button>
          <button className="primary-button" onClick={openNewForm}><Plus /> Add specimen</button>
          <button
            className={`sync-chip ${isOnline ? "online" : "offline"}`}
            onClick={() => { if (isOnline && user) void syncPendingChanges(user); }}
            disabled={!isOnline || syncing}
            title={isOnline ? "Sync pending offline changes" : "Changes are stored on this device until internet returns"}
          >
            {syncing ? <LoaderCircle className="spin" /> : isOnline ? <Cloud /> : <CloudOff />}
            <span><strong>{syncing ? "Syncing" : isOnline ? pendingCount ? `${pendingCount} pending` : "Online" : "Offline"}</strong><small>{isOnline ? pendingCount ? "Tap to sync" : "Offline copy ready" : `${pendingCount} waiting`}</small></span>
          </button>
          <button className="profile-button" onClick={logout}><span>{(user.name || user.email).slice(0, 1).toUpperCase()}</span><div><strong>{user.name || "Contributor"}</strong><small>{user.email}</small></div><LogOut /></button>
        </nav>
        <button className="menu-button" onClick={() => setMenuOpen((value) => !value)}>{menuOpen ? <X /> : <Menu />}</button>
      </header>

      <section className="hero-section reveal">
        <div className="hero-copy">
          <p className="eyebrow"><Sparkles size={16} /> Living agricultural records</p>
          <h1>From field observation to verified specimen.</h1>
          <p>Search every detail, preserve multiple photographic views, update specimen status, and keep a clear record of who contributed each entry.</p>
          <div className="hero-actions"><button className="primary-button" onClick={openNewForm}><ImagePlus /> Register a specimen</button><button className="ghost-button" onClick={() => document.getElementById("registry")?.scrollIntoView({ behavior: "smooth" })}><Search /> Explore records</button></div>
        </div>
        <div className="hero-visual glass">
          <div className="orbit orbit-one"><Leaf /></div>
          <div className="orbit orbit-two"><Bug /></div>
          <div className="specimen-emblem"><Sprout /><span>FIELD<br />TO<br />FINDING</span></div>
          <div className="soil-line" />
        </div>
      </section>

      <section className="stats-grid reveal">
        <article className="glass stat-card"><span><FlaskConical /></span><div><strong>{rows.length}</strong><p>Total specimens</p></div></article>
        <article className="glass stat-card"><span><ShieldCheck /></span><div><strong>{verifiedCount}</strong><p>Verified records</p></div></article>
        <article className="glass stat-card"><span><Camera /></span><div><strong>{withPhotosCount}</strong><p>With photographs</p></div></article>
        <article className="glass stat-card"><span><Leaf /></span><div><strong>{uniqueFamilies}</strong><p>Recorded families</p></div></article>
      </section>

      <section id="registry" className="registry-section reveal">
        <div className="section-heading"><div><p className="eyebrow">Specimen catalogue</p><h2>Searchable agricultural collection</h2></div><div className="section-actions"><button className="ghost-button" onClick={openImportModal}><FileSpreadsheet /> Import Excel</button><button className="primary-button" onClick={openNewForm}><Plus /> New record</button></div></div>
        <div className="glass search-panel">
          <label className="global-search"><Search /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search specimen number, taxonomy, location, host, collector, status, reference…" />{search && <button onClick={() => setSearch("")}><X /></button>}</label>
          <div className="advanced-filter">
            <Filter />
            <select value={filterField} onChange={(e) => setFilterField(e.target.value)}><option value="all">Choose a specific field</option>{specimenFields.map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}</select>
            <input value={filterValue} onChange={(e) => setFilterValue(e.target.value)} disabled={filterField === "all"} placeholder={filterField === "all" ? "Select a field first" : "Filter this field…"} />
          </div>
        </div>

        <div className="result-line"><span>{filteredRows.length} record{filteredRows.length === 1 ? "" : "s"}</span><div>{!isOnline && <span className="offline-copy-label"><CloudOff /> Offline copy</span>}{pendingCount > 0 && <span className="pending-copy-label"><RefreshCw /> {pendingCount} waiting to sync</span>}{loadingRows && <span><LoaderCircle className="spin" /> Refreshing</span>}</div></div>

        {filteredRows.length ? (
          <div className="specimen-grid">
            {filteredRows.map((row) => {
              const data = parseSpecimenData(row);
              const photos = parsePhotoMap(row);
              const cover = photos.front || photos.dorsal || photos.side || Object.values(photos)[0];
              const canEdit = row.createdById === user.$id;
              const collectorName = data.collectorsName?.trim() || "Collector not recorded";
              const collectorInitial = data.collectorsName?.trim().slice(0, 1).toUpperCase() || "C";
              return (
                <article className="glass specimen-card reveal" key={row.$id}>
                  <button className="card-visual" onClick={() => setDetailsRow(row)} aria-label={`Open ${row.specimenNo}`}>
                    {cover ? <PhotoImage fileId={cover} alt={displayScientificName(data)} /> : <div className="photo-placeholder"><Bug /><span>Optional photo not added</span></div>}
                    <span className={`status-badge ${row.sampleStatus?.toLowerCase().replace(/\s+/g, "-")}`}>{row.sampleStatus || "Unspecified"}</span>
                    {row.__offlineStatus && <span className="pending-badge"><RefreshCw /> Pending sync</span>}
                    <span className="view-icon"><Eye /></span>
                  </button>
                  <div className="card-content">
                    <div className="card-kicker"><span>{row.specimenNo}</span><span>{formatDate(row.dateCollection)}</span></div>
                    <h3><em>{displayScientificName(data)}</em></h3>
                    <p className="common-name">{data.commonName || "Common name not recorded"}</p>
                    <div className="mini-details"><span><Leaf />{data.family || "Family unassigned"}</span><span><MapPin />{[data.locality, data.province, data.country].filter(Boolean).join(", ") || "Location not recorded"}</span></div>
                    <div className="contributor"><div>{collectorInitial}</div><span>Collector <strong>{collectorName}</strong></span></div>
                    <div className="card-actions"><button onClick={() => setDetailsRow(row)}><Eye /> Details</button>{canEdit && <button onClick={() => openEditForm(row)}><Edit3 /> Edit</button>}</div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="glass empty-state"><Sprout /><h3>No specimen matches your search</h3><p>Clear the filters or register a new specimen record.</p><button className="primary-button" onClick={openNewForm}><Plus /> Add specimen</button></div>
        )}
      </section>

      <footer><div className="brand-mark compact"><Leaf /><span>AgriSpecimen</span></div><p>powered by Luntian</p></footer>

      {formOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <form className="modal-panel specimen-form" onSubmit={handleSave}>
            <div className="modal-header"><div><p className="eyebrow">{editingRow ? "Update every field" : "New collection entry"}</p><h2>{editingRow ? `Edit ${editingRow.specimenNo}` : "Register a specimen"}</h2><p>{editingRow ? "Every published specimen input can be changed, cleared, or completed later. Photos can also be added, replaced, or removed." : "Every specimen field and photograph is optional. A record ID is generated automatically when Specimen No. is left blank."}</p></div><button type="button" className="icon-button" onClick={() => setFormOpen(false)}><X /></button></div>
            {!isOnline && <div className="offline-form-banner"><CloudOff /><span>This record will be saved on this device and synchronized automatically when internet returns.</span></div>}
            <div className="form-scroll">
              {fieldGroups.map((group) => (
                <fieldset key={group} className="form-group reveal is-visible">
                  <legend>{group}</legend>
                  <div className="fields-grid">
                    {specimenFields.filter((field) => field.group === group).map((field) => (
                      <label key={field.key} className={field.type === "textarea" ? "wide" : ""}>{field.label}{field.required && <b>*</b>}<FieldInput field={field} value={formData[field.key] || ""} onChange={(value) => setFormData((current) => ({ ...current, [field.key]: value }))} /></label>
                    ))}
                  </div>
                </fieldset>
              ))}
              <fieldset className="form-group reveal is-visible">
                <legend>Optional specimen photographs</legend>
                <p className="group-note">Add any available view. New photos are automatically resized and converted to high-quality WebP before upload, usually saving most of the original file size. After publishing, the original contributor can add, replace, or remove every photograph.</p>
                <div className="photo-input-grid">
                  {photoSlots.map((slot) => {
                    const newFile = photoFiles[slot.key];
                    const existingId = existingPhotos[slot.key];
                    const compression = photoCompressionInfo[slot.key];
                    const isCompressing = Boolean(compressingPhotoSlots[slot.key]);
                    const savingPercent = compression && compression.originalBytes > 0
                      ? Math.max(0, Math.round((1 - compression.compressedBytes / compression.originalBytes) * 100))
                      : 0;
                    return (
                      <div className="photo-input-wrap" key={slot.key}>
                        <label className={`photo-input ${isCompressing ? "is-compressing" : ""}`}>
                          <input type="file" accept="image/jpeg,image/png,image/webp" disabled={isCompressing || saving} onChange={(event) => void selectPhotoForSlot(slot.key, event.target.files?.[0])} />
                          {isCompressing ? <LoaderCircle className="spin" /> : newFile ? <img src={URL.createObjectURL(newFile)} alt={slot.label} /> : existingId ? <PhotoImage fileId={existingId} alt={slot.label} /> : <UploadCloud />}
                          <span>{slot.label}</span>
                          <small>
                            {isCompressing
                              ? "Optimizing image before upload…"
                              : compression
                                ? compression.compressed
                                  ? `${formatFileSize(compression.originalBytes)} → ${formatFileSize(compression.compressedBytes)} · ${savingPercent}% smaller`
                                  : `Already optimized · ${formatFileSize(compression.compressedBytes)}`
                                : newFile?.name || (existingId ? "Existing photo—choose a file to replace" : "Optional JPG, PNG, or WebP")}
                          </small>
                        </label>
                        {(newFile || existingId) && !isCompressing && <button type="button" className="remove-photo-button" onClick={() => removePhotoSlot(slot.key)}><Trash2 /> Remove photo</button>}
                      </div>
                    );
                  })}
                </div>
              </fieldset>
            </div>
            <div className="modal-footer"><button type="button" className="ghost-button" onClick={() => setFormOpen(false)}>Cancel</button><button className="primary-button" disabled={saving || photoCompressionBusy}>{saving || photoCompressionBusy ? <LoaderCircle className="spin" /> : <Check />}{photoCompressionBusy ? "Optimizing photos…" : saving ? "Saving record…" : editingRow ? "Save changes" : "Add to registry"}</button></div>
          </form>
        </div>
      )}

      {importOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-panel import-panel">
            <div className="modal-header">
              <div><p className="eyebrow">Bulk registry entry</p><h2>Import specimen records from Excel</h2><p>Every imported record is attributed to your account. Duplicate Specimen No. values are skipped, and all imported fields remain editable afterward.</p></div>
              <button type="button" className="icon-button" onClick={() => setImportOpen(false)} disabled={importBusy}><X /></button>
            </div>
            <div className="import-scroll">
              <label className="excel-dropzone">
                <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => void analyzeImportFile(event.target.files?.[0])} disabled={importBusy} />
                {importBusy && !importProgress.total ? <LoaderCircle className="spin" /> : <FileSpreadsheet />}
                <strong>{importFileName || "Choose an .xlsx workbook"}</strong>
                <span>Use a normal table with one specimen per row. Blank cells are allowed.</span>
              </label>

              {importRows.length > 0 && (
                <>
                  <div className="import-metrics">
                    <article><ListChecks /><strong>{importPlan.total}</strong><span>Rows found</span></article>
                    <article><Check /><strong>{importPlan.importable}</strong><span>Ready to add</span></article>
                    <article><AlertTriangle /><strong>{importPlan.duplicates}</strong><span>Duplicates skipped</span></article>
                    <article><Sparkles /><strong>{importPlan.generatedIds}</strong><span>Automatic IDs</span></article>
                  </div>
                  <div className="import-preview">
                    <div className="import-preview-heading"><h3>Preview</h3><span>Showing the first {Math.min(importRows.length, 8)} rows</span></div>
                    <div className="import-preview-table">
                      <div className="import-preview-row header"><span>Specimen No.</span><span>Identification</span><span>Collection date</span><span>Source</span></div>
                      {importRows.slice(0, 8).map((item, index) => (
                        <div className="import-preview-row" key={`${item.sourceSheet}-${item.sourceRow}-${index}`}><span>{item.data.specimenNo || "Automatic ID"}</span><span><em>{displayScientificName(item.data)}</em></span><span>{item.data.dateCollection || "—"}</span><span>{item.sourceSheet}, row {item.sourceRow}</span></div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {importWarnings.length > 0 && <div className="import-warnings"><AlertTriangle /> <div>{importWarnings.map((warning) => <p key={warning}>{warning}</p>)}</div></div>}

              {importProgress.total > 0 && importBusy && (
                <div className="import-progress"><div><span>Importing records</span><strong>{importProgress.current} / {importProgress.total}</strong></div><progress value={importProgress.current} max={importProgress.total} /></div>
              )}

              {importSummary && (
                <div className="import-result"><Check /><div><h3>Import complete</h3><p><strong>{importSummary.added}</strong> added · <strong>{importSummary.duplicates}</strong> duplicates skipped · <strong>{importSummary.failed}</strong> failed</p></div></div>
              )}
            </div>
            <div className="modal-footer"><button type="button" className="ghost-button" onClick={() => setImportOpen(false)} disabled={importBusy}>{importSummary ? "Close" : "Cancel"}</button><button type="button" className="primary-button" onClick={() => void importExcelRows()} disabled={importBusy || importPlan.importable === 0}>{importBusy && importProgress.total ? <LoaderCircle className="spin" /> : <FileSpreadsheet />}{importBusy && importProgress.total ? "Importing…" : `Import ${importPlan.importable} record${importPlan.importable === 1 ? "" : "s"}`}</button></div>
          </div>
        </div>
      )}

      {detailsRow && (() => {
        const data = parseSpecimenData(detailsRow);
        const photos = parsePhotoMap(detailsRow);
        const canEdit = detailsRow.createdById === user.$id;
        const related = rows.filter((row) => row.$id !== detailsRow.$id && row.family && row.family.toLowerCase() === detailsRow.family?.toLowerCase()).slice(0, 4);
        return (
          <div className="modal-backdrop" role="dialog" aria-modal="true">
            <div className="modal-panel details-panel">
              <div className="modal-header"><div><p className="eyebrow">{detailsRow.specimenNo}</p><h2><em>{displayScientificName(data)}</em></h2><p>{data.commonName || "Common name not recorded"}</p></div><button className="icon-button" onClick={() => setDetailsRow(null)}><X /></button></div>
              <div className="details-toolbar"><button onClick={exportJpeg}><FileImage /> JPEG</button><button onClick={exportPdf}><FileText /> PDF</button><button onClick={() => void downloadPhotos(detailsRow)}><ArrowDownToLine /> Original photos</button>{canEdit && <button onClick={() => openEditForm(detailsRow)}><Edit3 /> Edit all fields</button>}</div>
              <div className="details-scroll">
                <div ref={exportRef} className="export-sheet">
                  <div className="export-title"><div className="brand-mark compact"><Leaf /><span>AgriSpecimen</span></div><p>{detailsRow.specimenNo}</p><h2><em>{displayScientificName(data)}</em></h2><span>{data.commonName || "Common name not recorded"}</span></div>
                  {Object.keys(photos).length > 0 ? <div className="details-gallery">{photoSlots.filter((slot) => photos[slot.key]).map((slot) => <figure key={slot.key}><PhotoImage fileId={photos[slot.key]} alt={slot.label} /><figcaption>{slot.label}</figcaption></figure>)}</div> : <div className="no-photos"><Camera /><p>No photographs were added to this record.</p></div>}
                  <div className="identity-strip"><span><strong>Entered by</strong>{detailsRow.createdByName}<small>{detailsRow.createdByEmail}</small></span><span><strong>Created</strong>{formatDate(detailsRow.$createdAt)}</span><span><strong>Last updated</strong>{formatDate(detailsRow.$updatedAt)}</span></div>
                  {fieldGroups.map((group) => (
                    <section className="detail-group" key={group}><h3>{group}</h3><div className="detail-grid">{specimenFields.filter((field) => field.group === group).map((field) => <div key={field.key}><span>{field.label}</span><strong className={field.key === "genus" || field.key === "species" || field.key === "subspecies" ? "italic" : ""}>{data[field.key] || "—"}</strong></div>)}</div></section>
                  ))}
                  <section className="detail-group suggestions"><h3><Sparkles /> Related-family and predator suggestions</h3><div className="suggestion-grid"><article><Leaf /><span>Related family records</span>{related.length ? <div className="related-list">{related.map((row) => <button key={row.$id} onClick={() => setDetailsRow(row)}><strong>{row.specimenNo}</strong><em>{displayScientificName(parseSpecimenData(row))}</em></button>)}</div> : <p>No other specimen from <strong>{data.family || "this family"}</strong> has been recorded yet.</p>}</article><article><Bug /><span>Possible predator</span><p>{data.possiblePredator || "No supported predator relationship has been entered. Add one only after observation or verification."}</p><small>Suggestion data should be reviewed by a qualified taxonomist or pest-management specialist.</small></article></div></section>
                </div>
                <section className="status-editor"><div><h3>Update specimen status</h3><p>{canEdit ? "As the contributor, you can toggle this record's current status." : "Only the original contributor can change this record."}</p></div><div className="status-options">{SAMPLE_STATUSES.map((status) => <button key={status} disabled={!canEdit} className={detailsRow.sampleStatus === status ? "active" : ""} onClick={() => quickStatus(detailsRow, status)}>{detailsRow.sampleStatus === status && <Check />}{status}</button>)}</div></section>
              </div>
              <div className="modal-footer"><button className="ghost-button" onClick={() => setDetailsRow(null)}>Close</button>{canEdit && <><button className="danger-button" onClick={() => deleteRow(detailsRow)}><Trash2 /> Delete</button><button className="primary-button" onClick={() => openEditForm(detailsRow)}><Edit3 /> Edit all fields</button></>}</div>
            </div>
          </div>
        );
      })()}

      {toast && <div className={`toast ${toast.type}`}>{toast.type === "success" ? <Check /> : <X />}{toast.message}</div>}
    </main>
  );
}
