import { strFromU8, unzipSync } from "fflate";
import { emptySpecimen, photoSlots, specimenFields, type SpecimenData } from "./specimen-fields";

type CellValue = string | number | boolean | Date | null;
type WorksheetRow = CellValue[];

type WorksheetImage = {
  rowIndex: number;
  columnIndex: number;
  file: File;
  sourcePath: string;
};

type WorkbookSheet = {
  name: string;
  rows: WorksheetRow[];
  images: WorksheetImage[];
};

export type ParsedImportPhoto = {
  slotKey: string;
  file: File;
  sourceColumn: number;
  sourceName: string;
};

export type ParsedImportRow = {
  data: SpecimenData;
  photos: ParsedImportPhoto[];
  sourceSheet: string;
  sourceRow: number;
};

export type WorkbookImportAnalysis = {
  rows: ParsedImportRow[];
  warnings: string[];
};

const fieldAliases: Record<string, string> = {};

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "");
}

function registerAlias(key: string, ...labels: string[]) {
  for (const label of labels) fieldAliases[normalizeHeader(label)] = key;
}

for (const field of specimenFields) {
  registerAlias(field.key, field.key, field.label, field.label.replace(/\s*\(optional\)\s*/gi, ""));
}

registerAlias("specimenNo", "Specimen No", "Specimen Number", "Isolate No", "Accession No");
registerAlias("dateCollection", "Date Collected", "Collection Date");
registerAlias("speciesId", "SpeciesID", "Initial Species ID", "Initial ID");
registerAlias("verifiedId", "Verified Species ID", "Verified Identification");
registerAlias("dateVerification", "Verification Date");
registerAlias("meansVerification", "Verification Method", "Means of Identification");
registerAlias("hostPlantVariety", "Host Plant & Variety", "Host Plant", "Plant Variety");
registerAlias("lastFound", "LastFound", "Last Seen");
registerAlias("className", "Class Name");
registerAlias("orderName", "Order Name");
registerAlias("subOrder", "Suborder");
registerAlias("subFamily", "Subfamily");
registerAlias("numberSamples", "Number of Samples", "No. of Samples", "Sample Count", "Quantity");
registerAlias("commonName", "CommonName", "Common name");
registerAlias("collectorsName", "Collectors Name", "Collector Name", "Collected By");
registerAlias("taxonomicStatus", "TaxonomicStatus");
registerAlias("hostPreyFood", "Host/Prey/Food", "Host Prey Food", "Hosts");
registerAlias("possiblePredator", "Possible Predator");
registerAlias("notes", "Notes", "Additional Notes", "Remarks", "Comments");
registerAlias("area", "Area", "Collection Area", "Sampling Area");
registerAlias("site", "Site", "Site No", "Site Number", "Sampling Site");
registerAlias("colonyMargin", "Colony Morphology Margin", "Colony Margin", "Margin");
registerAlias("colonyElevation", "Colony Morphology Elevation", "Colony Elevation");
registerAlias("colonyShape", "Colony Morphology Shape", "Colony Shape");
registerAlias("colonyColour", "Colony Morphology Colour", "Colony Morphology Color", "Colony Colour", "Colony Color", "Colour", "Color");
registerAlias("colonyDiameter", "Colony Morphology Diameter", "Colony Diameter", "Diameter");
registerAlias("cellShape", "Cell Characteristics Shape", "Cell Shape");
registerAlias("gramStainingReaction", "Cell Characteristics Gram Staining Reaction", "Gram Staining Reaction", "Gram Reaction");

const noteOnlyHeaders = new Set([
  "accessedfrom",
  "dateofextraction",
  "domain",
  "kingdom",
  "strain",
  "source",
  "sourcedataset",
]);

const photoHeaderAliases: Record<string, string> = {};

function registerPhotoAlias(slotKey: string, ...labels: string[]) {
  for (const label of labels) photoHeaderAliases[normalizeHeader(label)] = slotKey;
}

registerPhotoAlias("front", "Photo", "Image", "Picture", "Specimen Photo", "Specimen Image", "Front", "Front View");
registerPhotoAlias("side", "Side", "Side View", "Lateral", "Lateral View");
registerPhotoAlias("dorsal", "Dorsal", "Dorsal View", "Top", "Top View");
registerPhotoAlias("ventral", "Ventral", "Ventral View", "Bottom", "Bottom View");
registerPhotoAlias("label", "Label Photo", "Specimen Label", "Label Image");
registerPhotoAlias("habitatPhoto", "Habitat Photo", "Host Plant Photo", "Habitat Image", "Host Image");
registerPhotoAlias("other", "Other Photo", "Other Image", "Additional Photo", "Additional Image");

const imageMimeTypes: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  bmp: "image/bmp",
  tif: "image/tiff",
  tiff: "image/tiff",
};

function parseXml(bytes?: Uint8Array): Document | null {
  if (!bytes) return null;
  const xml = new DOMParser().parseFromString(strFromU8(bytes), "application/xml");
  if (xml.getElementsByTagName("parsererror").length) throw new Error("The Excel workbook contains invalid XML.");
  return xml;
}

function elementsByLocalName(parent: Document | Element, name: string): Element[] {
  return Array.from(parent.getElementsByTagNameNS("*", name));
}

function normalizeZipPath(basePath: string, target: string): string {
  const combined = target.startsWith("/") ? target.slice(1) : `${basePath}/${target}`;
  const parts = combined.split("/");
  const normalized: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") normalized.pop();
    else normalized.push(part);
  }
  return normalized.join("/");
}

function directoryName(path: string): string {
  const index = path.lastIndexOf("/");
  return index < 0 ? "" : path.slice(0, index);
}

function baseName(path: string): string {
  return path.split("/").pop() || "embedded-image";
}

function relationshipsPath(ownerPath: string): string {
  const directory = directoryName(ownerPath);
  return `${directory}/_rels/${baseName(ownerPath)}.rels`;
}

function readRelationships(files: Record<string, Uint8Array>, ownerPath: string): Map<string, string> {
  const document = parseXml(files[relationshipsPath(ownerPath)]);
  const relationships = new Map<string, string>();
  if (!document) return relationships;

  for (const relationship of elementsByLocalName(document, "Relationship")) {
    if (relationship.getAttribute("TargetMode") === "External") continue;
    const id = relationship.getAttribute("Id");
    const target = relationship.getAttribute("Target");
    if (id && target) relationships.set(id, normalizeZipPath(directoryName(ownerPath), target));
  }
  return relationships;
}

function relationshipId(element: Element, localName: string): string | null {
  return element.getAttribute(`r:${localName}`)
    ?? element.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", localName);
}

function mimeTypeForPath(path: string): string {
  const extension = path.split(".").pop()?.toLowerCase() || "";
  return imageMimeTypes[extension] || "application/octet-stream";
}

function copyBytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}
function columnIndexFromReference(reference: string): number {
  const letters = reference.match(/^[A-Z]+/i)?.[0]?.toUpperCase() ?? "A";
  let result = 0;
  for (const letter of letters) result = result * 26 + letter.charCodeAt(0) - 64;
  return Math.max(0, result - 1);
}

function readSharedStrings(files: Record<string, Uint8Array>): string[] {
  const document = parseXml(files["xl/sharedStrings.xml"]);
  if (!document) return [];
  return elementsByLocalName(document, "si").map((item) =>
    elementsByLocalName(item, "t").map((text) => text.textContent ?? "").join(""),
  );
}

function parseCellValue(cell: Element, sharedStrings: string[]): CellValue {
  const type = cell.getAttribute("t") ?? "";
  if (type === "inlineStr") {
    return elementsByLocalName(cell, "t").map((text) => text.textContent ?? "").join("");
  }

  const rawValue = elementsByLocalName(cell, "v")[0]?.textContent ?? "";
  if (type === "s") return sharedStrings[Number(rawValue)] ?? "";
  if (type === "b") return rawValue === "1";
  if (type === "str" || type === "e") return rawValue;
  if (rawValue === "") return "";

  const numberValue = Number(rawValue);
  return Number.isFinite(numberValue) ? numberValue : rawValue;
}

function readWorksheetRows(document: Document, sharedStrings: string[]): WorksheetRow[] {
  const rows: WorksheetRow[] = [];
  for (const rowElement of elementsByLocalName(document, "row")) {
    const rowNumber = Number(rowElement.getAttribute("r") ?? rows.length + 1);
    const row: WorksheetRow = [];
    for (const cell of elementsByLocalName(rowElement, "c")) {
      const reference = cell.getAttribute("r") ?? "A1";
      row[columnIndexFromReference(reference)] = parseCellValue(cell, sharedStrings);
    }
    rows[Math.max(0, rowNumber - 1)] = row;
  }
  return rows.map((row) => row ?? []);
}

function readWorksheetImages(
  files: Record<string, Uint8Array>,
  worksheetPath: string,
  worksheet: Document,
): WorksheetImage[] {
  const worksheetRelationships = readRelationships(files, worksheetPath);
  const images: WorksheetImage[] = [];

  for (const drawingElement of elementsByLocalName(worksheet, "drawing")) {
    const drawingRelationshipId = relationshipId(drawingElement, "id");
    const drawingPath = drawingRelationshipId ? worksheetRelationships.get(drawingRelationshipId) : undefined;
    if (!drawingPath) continue;

    const drawing = parseXml(files[drawingPath]);
    if (!drawing) continue;
    const drawingRelationships = readRelationships(files, drawingPath);
    const anchors = [
      ...elementsByLocalName(drawing, "oneCellAnchor"),
      ...elementsByLocalName(drawing, "twoCellAnchor"),
    ];

    for (const anchor of anchors) {
      const from = elementsByLocalName(anchor, "from")[0];
      const blip = elementsByLocalName(anchor, "blip")[0];
      if (!from || !blip) continue;

      const rowIndex = Number(elementsByLocalName(from, "row")[0]?.textContent ?? -1);
      const columnIndex = Number(elementsByLocalName(from, "col")[0]?.textContent ?? -1);
      const embeddedRelationshipId = relationshipId(blip, "embed");
      const sourcePath = embeddedRelationshipId ? drawingRelationships.get(embeddedRelationshipId) : undefined;
      const bytes = sourcePath ? files[sourcePath] : undefined;
      const mimeType = sourcePath ? mimeTypeForPath(sourcePath) : "";
      if (rowIndex < 0 || columnIndex < 0 || !sourcePath || !bytes || !mimeType.startsWith("image/")) continue;

      images.push({
        rowIndex,
        columnIndex,
        sourcePath,
        file: new File([copyBytesToArrayBuffer(bytes)], baseName(sourcePath), { type: mimeType, lastModified: Date.now() }),
      });
    }
  }

  return images;
}

async function readWorkbookSheets(file: File): Promise<WorkbookSheet[]> {
  const files = unzipSync(new Uint8Array(await file.arrayBuffer()));
  const workbook = parseXml(files["xl/workbook.xml"]);
  const relationships = parseXml(files["xl/_rels/workbook.xml.rels"]);
  if (!workbook || !relationships) throw new Error("This file is not a readable .xlsx workbook.");

  const relationshipTargets = new Map<string, string>();
  for (const relationship of elementsByLocalName(relationships, "Relationship")) {
    const id = relationship.getAttribute("Id");
    const target = relationship.getAttribute("Target");
    if (id && target) relationshipTargets.set(id, normalizeZipPath("xl", target));
  }

  const sharedStrings = readSharedStrings(files);
  const sheets: WorkbookSheet[] = [];
  for (const sheetElement of elementsByLocalName(workbook, "sheet")) {
    const name = sheetElement.getAttribute("name") ?? "Sheet";
    const relationshipId = sheetElement.getAttribute("r:id")
      ?? sheetElement.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
    if (!relationshipId) continue;
    const path = relationshipTargets.get(relationshipId);
    if (!path) continue;
    const worksheet = parseXml(files[path]);
    if (!worksheet) continue;
    sheets.push({
      name,
      rows: readWorksheetRows(worksheet, sharedStrings),
      images: readWorksheetImages(files, path, worksheet),
    });
  }
  return sheets;
}

function cellToText(value: CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return String(value).trim();
}

function excelSerialToDate(serial: number): string {
  const milliseconds = Math.round((serial - 25569) * 86400 * 1000);
  const date = new Date(milliseconds);
  if (Number.isNaN(date.getTime())) return String(serial);
  return date.toISOString().slice(0, 10);
}

function normalizeDateValue(value: CellValue): string {
  if (typeof value === "number") return excelSerialToDate(value);
  const text = cellToText(value);
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const corrected = text.replace(/^Apil\b/i, "April").replace(/,(\d{4})$/, ", $1");
  const parsed = new Date(corrected);
  if (Number.isNaN(parsed.getTime())) return text;
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
}

function appendNote(data: SpecimenData, text: string) {
  if (!text.trim()) return;
  data.notes = [data.notes, text.trim()].filter(Boolean).join("; ");
}

function applyCoordinates(value: string, data: SpecimenData) {
  const matches = value.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  if (matches.length < 2) return;
  const [first, second] = matches;
  if (Math.abs(first) <= 90 && Math.abs(second) > 90) {
    data.latitude = String(first);
    data.longitude = String(second);
  } else if (Math.abs(second) <= 90 && Math.abs(first) > 90) {
    data.longitude = String(first);
    data.latitude = String(second);
  } else {
    data.latitude = String(first);
    data.longitude = String(second);
  }
}

function photosForRow(images: WorksheetImage[], rowIndex: number, headers: string[]): ParsedImportPhoto[] {
  const rowImages = images.filter((image) => image.rowIndex === rowIndex);
  const usedSlots = new Set<string>();
  const parsed: ParsedImportPhoto[] = [];

  for (const image of rowImages) {
    const header = headers[image.columnIndex] || "";
    let slotKey = photoHeaderAliases[normalizeHeader(header)] || "front";
    if (usedSlots.has(slotKey)) {
      slotKey = photoSlots.find((slot) => !usedSlots.has(slot.key))?.key || "other";
    }
    if (usedSlots.has(slotKey)) continue;
    usedSlots.add(slotKey);
    parsed.push({
      slotKey,
      file: image.file,
      sourceColumn: image.columnIndex + 1,
      sourceName: image.sourcePath,
    });
  }

  return parsed;
}

type HeaderPlan = {
  headers: string[];
  dataStartIndex: number;
  score: number;
  hasPrimaryId: boolean;
};

const groupedHeaderNames = new Set([
  "colonymorphology",
  "cellcharacteristics",
]);

function isRecognizedHeader(value: string): boolean {
  const normalized = normalizeHeader(value);
  return Boolean(
    fieldAliases[normalized]
      || photoHeaderAliases[normalized]
      || normalized === "coordinates"
      || noteOnlyHeaders.has(normalized),
  );
}

function buildHeaderPlan(rows: WorksheetRow[], topIndex: number, depth: 1 | 2): HeaderPlan {
  const topRow = rows[topIndex] ?? [];
  const lowerRow = depth === 2 ? (rows[topIndex + 1] ?? []) : [];
  const columnCount = Math.max(topRow.length, lowerRow.length);
  const inheritedGroups: string[] = new Array(columnCount).fill("");
  let activeGroup = "";

  for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
    const topValue = cellToText(topRow[columnIndex] ?? null);
    const normalizedTop = normalizeHeader(topValue);

    if (groupedHeaderNames.has(normalizedTop)) {
      activeGroup = topValue;
    } else if (topValue) {
      activeGroup = "";
    }

    inheritedGroups[columnIndex] = activeGroup;
  }

  const headers: string[] = [];
  let score = 0;
  let hasPrimaryId = false;

  for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
    const topValue = cellToText(topRow[columnIndex] ?? null);
    const lowerValue = cellToText(lowerRow[columnIndex] ?? null);
    const groupValue = inheritedGroups[columnIndex];
    const candidates: string[] = [];

    if (
      topValue
      && isRecognizedHeader(topValue)
      && !groupedHeaderNames.has(normalizeHeader(topValue))
    ) {
      candidates.push(topValue);
    }

    if (groupValue && lowerValue) candidates.push(groupValue + " " + lowerValue);
    if (lowerValue) candidates.push(lowerValue);
    if (topValue) candidates.push(topValue);

    const resolved = candidates.find(isRecognizedHeader) || candidates[0] || "";
    headers[columnIndex] = resolved;

    if (isRecognizedHeader(resolved)) {
      score += 1;
      if (fieldAliases[normalizeHeader(resolved)] === "specimenNo") {
        hasPrimaryId = true;
      }
    }
  }

  return {
    headers,
    dataStartIndex: topIndex + depth,
    score,
    hasPrimaryId,
  };
}

function findHeaderPlan(rows: WorksheetRow[]): HeaderPlan | null {
  const maxRows = Math.min(rows.length, 20);
  let best: HeaderPlan | null = null;

  for (let rowIndex = 0; rowIndex < maxRows; rowIndex += 1) {
    const candidates: HeaderPlan[] = [buildHeaderPlan(rows, rowIndex, 1)];

    if (rowIndex + 1 < rows.length) {
      candidates.push(buildHeaderPlan(rows, rowIndex, 2));
    }

    for (const candidate of candidates) {
      const usable = candidate.score >= 2
        && (candidate.hasPrimaryId || candidate.score >= 4);

      if (!usable) continue;

      if (!best || candidate.score > best.score) {
        best = candidate;
      }
    }
  }

  return best;
}

function parseSheetRows(
  sheetName: string,
  rows: WorksheetRow[],
  images: WorksheetImage[],
): ParsedImportRow[] {
  const plan = findHeaderPlan(rows);
  if (!plan) return [];

  const parsed: ParsedImportRow[] = [];

  for (let rowIndex = plan.dataStartIndex; rowIndex < rows.length; rowIndex += 1) {
    const sourceRow = rows[rowIndex] ?? [];
    const data = emptySpecimen();
    let recognizedValueCount = 0;

    for (let columnIndex = 0; columnIndex < plan.headers.length; columnIndex += 1) {
      const header = plan.headers[columnIndex];
      const normalizedHeader = normalizeHeader(header);
      const sourceValue = sourceRow[columnIndex] ?? null;
      const value = cellToText(sourceValue);
      if (!value) continue;

      if (normalizedHeader === "coordinates") {
        applyCoordinates(value, data);
        recognizedValueCount += 1;
        continue;
      }

      const key = fieldAliases[normalizedHeader];
      if (key) {
        data[key] = ["dateCollection", "dateVerification", "lastFound"].includes(key)
          ? normalizeDateValue(sourceValue)
          : value;
        recognizedValueCount += 1;
        continue;
      }

      if (noteOnlyHeaders.has(normalizedHeader)) {
        appendNote(data, header + ": " + value);
        recognizedValueCount += 1;
      }
    }

    if (recognizedValueCount === 0) continue;

    const meaningfulValues = Object.values(data)
      .filter((value) => String(value).trim());

    if (meaningfulValues.length === 0) continue;

    parsed.push({
      data,
      photos: photosForRow(images, rowIndex, plan.headers),
      sourceSheet: sheetName,
      sourceRow: rowIndex + 1,
    });
  }

  return parsed;
}

export async function parseRegistryWorkbook(file: File): Promise<WorkbookImportAnalysis> {
  const warnings: string[] = [];
  const rows: ParsedImportRow[] = [];
  const sheets = await readWorkbookSheets(file);

  for (const sheet of sheets) {
    const normalizedSheetName = normalizeHeader(sheet.name);
    if (normalizedSheetName.includes("notes") || normalizedSheetName.includes("readme") || normalizedSheetName.includes("instructions")) continue;
    const parsed = parseSheetRows(sheet.name, sheet.rows, sheet.images);
    if (parsed.length === 0) {
      warnings.push(`Sheet "${sheet.name}" did not contain a normal row-based specimen table and was skipped.`);
      continue;
    }

    const assignedImages = parsed.reduce((sum, item) => sum + item.photos.length, 0);
    if (sheet.images.length > assignedImages) {
      warnings.push(`${sheet.images.length - assignedImages} embedded image${sheet.images.length - assignedImages === 1 ? "" : "s"} in sheet "${sheet.name}" could not be matched to a specimen row and were skipped.`);
    }

    const hasMergedRecords = parsed.some((item) => {
      const identifiers = item.data.specimenNo.match(/\b(?:SRA|AUTO)-[A-Z0-9-]+\b/gi) ?? [];
      return identifiers.length > 1;
    });
    if (hasMergedRecords) {
      warnings.push(`Sheet "${sheet.name}" appears to contain several specimens merged into one cell row. Use the normalized registry-import workbook instead.`);
      continue;
    }

    rows.push(...parsed);
  }

  if (rows.length === 0) {
    warnings.push("No importable specimen rows were found. The workbook may contain the table as drawing objects instead of editable cells.");
  }

  return { rows, warnings };
}

