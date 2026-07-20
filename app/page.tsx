"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  BookOpenText,
  Bug,
  Camera,
  Check,
  ChevronDown,
  CircleUserRound,
  Download,
  Edit3,
  Eye,
  FileImage,
  FileText,
  Filter,
  FlaskConical,
  ImagePlus,
  Leaf,
  LoaderCircle,
  LogOut,
  MapPin,
  Menu,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Sprout,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { ID, Permission, Query, Role, type Models } from "appwrite";
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

const SAMPLE_STATUSES = ["Collected", "In examination", "Awaiting verification", "Verified", "Preserved", "Archived"];

type AuthMode = "login" | "register";
type Toast = { type: "success" | "error"; message: string } | null;

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
    return (
      <select {...common}>
        <option value="">Select an option</option>
        {field.options?.map((option) => <option key={option}>{option}</option>)}
      </select>
    );
  }

  return <input {...common} type={field.type} step={field.step} placeholder={field.placeholder} />;
}

function PhotoImage({ fileId, alt, className = "" }: { fileId: string; alt: string; className?: string }) {
  const src = String(storage.getFilePreview({ bucketId: APPWRITE_BUCKET_ID, fileId, width: 1400, height: 1000, quality: 88 }));
  return <img src={src} alt={alt} className={className} crossOrigin="anonymous" />;
}

export default function Home() {
  const [user, setUser] = useState<Models.User<Models.Preferences> | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
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
  const [existingPhotos, setExistingPhotos] = useState<PhotoMap>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  const showToast = (next: Toast) => {
    setToast(next);
    window.setTimeout(() => setToast(null), 4200);
  };

  const loadRows = async () => {
    if (!appwriteConfigured) return;
    setLoadingRows(true);
    try {
      const response = await tablesDB.listRows({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_TABLE_ID,
        queries: [Query.orderDesc("$createdAt"), Query.limit(500)],
        total: true,
        ttl: 0,
      });
      setRows(response.rows as SpecimenRow[]);
    } catch (error) {
      showToast({ type: "error", message: `Could not load specimens: ${appwriteError(error)}` });
    } finally {
      setLoadingRows(false);
    }
  };

  useEffect(() => {
    if (!appwriteConfigured) {
      setCheckingSession(false);
      return;
    }
    account.get()
      .then((current) => setUser(current))
      .catch(() => setUser(null))
      .finally(() => setCheckingSession(false));
  }, []);

  useEffect(() => {
    if (user) void loadRows();
  }, [user]);

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

  useEffect(() => {
    const elements = document.querySelectorAll<HTMLElement>(".reveal");
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => entry.target.classList.toggle("is-visible", entry.isIntersecting)),
      { threshold: 0.12, rootMargin: "0px 0px -35px 0px" },
    );
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [filteredRows.length, user, formOpen, detailsRow]);

  const handleAuth = async (event: FormEvent) => {
    event.preventDefault();
    setAuthBusy(true);
    try {
      if (authMode === "register") {
        await account.create({ userId: ID.unique(), email: authEmail.trim(), password: authPassword, name: authName.trim() });
      }
      await account.createEmailPasswordSession({ email: authEmail.trim(), password: authPassword });
      const current = await account.get();
      setUser(current);
      setAuthPassword("");
      showToast({ type: "success", message: authMode === "register" ? "Account created successfully." : "Welcome back." });
    } catch (error) {
      showToast({ type: "error", message: appwriteError(error) });
    } finally {
      setAuthBusy(false);
    }
  };

  const logout = async () => {
    try {
      await account.deleteSession({ sessionId: "current" });
    } finally {
      setUser(null);
      setRows([]);
      setMenuOpen(false);
    }
  };

  const openNewForm = () => {
    setEditingRow(null);
    setFormData(emptySpecimen());
    setPhotoFiles({});
    setExistingPhotos({});
    setFormOpen(true);
  };

  const openEditForm = (row: SpecimenRow) => {
    setEditingRow(row);
    setFormData({ ...emptySpecimen(), ...parseSpecimenData(row) });
    setPhotoFiles({});
    setExistingPhotos(parsePhotoMap(row));
    setDetailsRow(null);
    setFormOpen(true);
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const uploaded: PhotoMap = { ...existingPhotos };
      for (const slot of photoSlots) {
        const file = photoFiles[slot.key];
        if (!file) continue;
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
      }

      const dataJson = JSON.stringify(formData);
      const searchText = buildSearchText(formData, user.name || user.email, user.email);
      const core = {
        specimenNo: formData.specimenNo,
        speciesId: formData.speciesId || "",
        verifiedId: formData.verifiedId || "",
        dateCollection: toIsoDate(formData.dateCollection) || null,
        dateVerification: toIsoDate(formData.dateVerification) || null,
        family: formData.family || "",
        genus: formData.genus || "",
        species: formData.species || "",
        commonName: formData.commonName || "",
        sampleStatus: formData.sampleStatus || "Collected",
        conservationStatus: formData.conservationStatus || "Not evaluated",
        taxonomicStatus: formData.taxonomicStatus || "Needs review",
        createdById: editingRow?.createdById || user.$id,
        createdByName: editingRow?.createdByName || user.name || user.email,
        createdByEmail: editingRow?.createdByEmail || user.email,
        dataJson,
        photoJson: JSON.stringify(uploaded),
        searchText,
      };

      if (editingRow) {
        await tablesDB.updateRow({
          databaseId: APPWRITE_DATABASE_ID,
          tableId: APPWRITE_TABLE_ID,
          rowId: editingRow.$id,
          data: core,
        });
        showToast({ type: "success", message: "Specimen record updated." });
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
        showToast({ type: "success", message: "Specimen added to the registry." });
      }
      setFormOpen(false);
      await loadRows();
    } catch (error) {
      showToast({ type: "error", message: `Could not save: ${appwriteError(error)}` });
    } finally {
      setSaving(false);
    }
  };

  const quickStatus = async (row: SpecimenRow, status: string) => {
    if (!user || row.createdById !== user.$id) return;
    const data = { ...parseSpecimenData(row), sampleStatus: status };
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
      setRows((current) => current.map((item) => item.$id === row.$id ? { ...item, sampleStatus: status, dataJson: JSON.stringify(data) } : item));
      if (detailsRow?.$id === row.$id) setDetailsRow({ ...detailsRow, sampleStatus: status, dataJson: JSON.stringify(data) });
      showToast({ type: "success", message: `Status changed to ${status}.` });
    } catch (error) {
      showToast({ type: "error", message: appwriteError(error) });
    }
  };

  const deleteRow = async (row: SpecimenRow) => {
    if (!user || row.createdById !== user.$id) return;
    if (!window.confirm(`Delete specimen ${row.specimenNo}? This cannot be undone.`)) return;
    try {
      await tablesDB.deleteRow({ databaseId: APPWRITE_DATABASE_ID, tableId: APPWRITE_TABLE_ID, rowId: row.$id });
      setRows((current) => current.filter((item) => item.$id !== row.$id));
      setDetailsRow(null);
      showToast({ type: "success", message: "Specimen record deleted." });
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

  const downloadPhotos = (row: SpecimenRow) => {
    const photos = Object.entries(parsePhotoMap(row));
    if (!photos.length) {
      showToast({ type: "error", message: "This record has no uploaded photographs." });
      return;
    }
    photos.forEach(([slot, fileId], index) => {
      window.setTimeout(() => {
        const anchor = document.createElement("a");
        anchor.href = String(storage.getFileDownload({ bucketId: APPWRITE_BUCKET_ID, fileId }));
        anchor.download = `${safeFilename(row.specimenNo)}-${slot}`;
        anchor.target = "_blank";
        anchor.click();
      }, index * 250);
    });
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
          <div className="brand-mark"><Leaf /><span>AgriSpecimen</span></div>
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
        <button className="brand-mark compact" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}><Leaf /><span>AgriSpecimen</span></button>
        <nav className={menuOpen ? "nav-actions open" : "nav-actions"}>
          <button className="ghost-button" onClick={() => document.getElementById("registry")?.scrollIntoView({ behavior: "smooth" })}><BookOpenText /> Registry</button>
          <button className="primary-button" onClick={openNewForm}><Plus /> Add specimen</button>
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
        <div className="section-heading"><div><p className="eyebrow">Specimen catalogue</p><h2>Searchable agricultural collection</h2></div><button className="primary-button" onClick={openNewForm}><Plus /> New record</button></div>
        <div className="glass search-panel">
          <label className="global-search"><Search /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search specimen number, taxonomy, location, host, collector, status, reference…" />{search && <button onClick={() => setSearch("")}><X /></button>}</label>
          <div className="advanced-filter">
            <Filter />
            <select value={filterField} onChange={(e) => setFilterField(e.target.value)}><option value="all">Choose a specific field</option>{specimenFields.map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}</select>
            <input value={filterValue} onChange={(e) => setFilterValue(e.target.value)} disabled={filterField === "all"} placeholder={filterField === "all" ? "Select a field first" : "Filter this field…"} />
          </div>
        </div>

        <div className="result-line"><span>{filteredRows.length} record{filteredRows.length === 1 ? "" : "s"}</span>{loadingRows && <span><LoaderCircle className="spin" /> Refreshing</span>}</div>

        {filteredRows.length ? (
          <div className="specimen-grid">
            {filteredRows.map((row) => {
              const data = parseSpecimenData(row);
              const photos = parsePhotoMap(row);
              const cover = photos.front || photos.dorsal || photos.side || Object.values(photos)[0];
              const canEdit = row.createdById === user.$id;
              return (
                <article className="glass specimen-card reveal" key={row.$id}>
                  <button className="card-visual" onClick={() => setDetailsRow(row)} aria-label={`Open ${row.specimenNo}`}>
                    {cover ? <PhotoImage fileId={cover} alt={displayScientificName(data)} /> : <div className="photo-placeholder"><Bug /><span>Optional photo not added</span></div>}
                    <span className={`status-badge ${row.sampleStatus?.toLowerCase().replace(/\s+/g, "-")}`}>{row.sampleStatus || "Collected"}</span>
                    <span className="view-icon"><Eye /></span>
                  </button>
                  <div className="card-content">
                    <div className="card-kicker"><span>{row.specimenNo}</span><span>{formatDate(row.dateCollection)}</span></div>
                    <h3><em>{displayScientificName(data)}</em></h3>
                    <p className="common-name">{data.commonName || "Common name not recorded"}</p>
                    <div className="mini-details"><span><Leaf />{data.family || "Family unassigned"}</span><span><MapPin />{[data.locality, data.province, data.country].filter(Boolean).join(", ") || "Location not recorded"}</span></div>
                    <div className="contributor"><div>{row.createdByName.slice(0, 1).toUpperCase()}</div><span>Entered by <strong>{row.createdByName}</strong><small>{formatDate(row.$createdAt)}</small></span></div>
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

      <footer><div className="brand-mark compact"><Leaf /><span>AgriSpecimen</span></div><p>A liquid-glass agricultural specimen registry powered by Appwrite, GitHub, and Vercel.</p></footer>

      {formOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <form className="modal-panel specimen-form" onSubmit={handleSave}>
            <div className="modal-header"><div><p className="eyebrow">{editingRow ? "Update record" : "New collection entry"}</p><h2>{editingRow ? `Edit ${editingRow.specimenNo}` : "Register a specimen"}</h2><p>Only the Specimen No. is required. Photographs are optional.</p></div><button type="button" className="icon-button" onClick={() => setFormOpen(false)}><X /></button></div>
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
                <p className="group-note">Add any available view. You may leave every photo empty and add them later.</p>
                <div className="photo-input-grid">
                  {photoSlots.map((slot) => {
                    const newFile = photoFiles[slot.key];
                    const existingId = existingPhotos[slot.key];
                    return (
                      <label className="photo-input" key={slot.key}>
                        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setPhotoFiles((current) => ({ ...current, [slot.key]: event.target.files?.[0] }))} />
                        {newFile ? <img src={URL.createObjectURL(newFile)} alt={slot.label} /> : existingId ? <PhotoImage fileId={existingId} alt={slot.label} /> : <UploadCloud />}
                        <span>{slot.label}</span><small>{newFile?.name || (existingId ? "Existing photo—choose a file to replace" : "Optional JPG, PNG, or WebP")}</small>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </div>
            <div className="modal-footer"><button type="button" className="ghost-button" onClick={() => setFormOpen(false)}>Cancel</button><button className="primary-button" disabled={saving}>{saving ? <LoaderCircle className="spin" /> : <Check />}{saving ? "Saving record…" : editingRow ? "Save changes" : "Add to registry"}</button></div>
          </form>
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
              <div className="details-toolbar"><button onClick={exportJpeg}><FileImage /> JPEG</button><button onClick={exportPdf}><FileText /> PDF</button><button onClick={() => downloadPhotos(detailsRow)}><ArrowDownToLine /> Original photos</button>{canEdit && <button onClick={() => openEditForm(detailsRow)}><Edit3 /> Edit record</button>}</div>
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
              <div className="modal-footer"><button className="ghost-button" onClick={() => setDetailsRow(null)}>Close</button>{canEdit && <><button className="danger-button" onClick={() => deleteRow(detailsRow)}><Trash2 /> Delete</button><button className="primary-button" onClick={() => openEditForm(detailsRow)}><Edit3 /> Edit record</button></>}</div>
            </div>
          </div>
        );
      })()}

      {toast && <div className={`toast ${toast.type}`}>{toast.type === "success" ? <Check /> : <X />}{toast.message}</div>}
    </main>
  );
}
