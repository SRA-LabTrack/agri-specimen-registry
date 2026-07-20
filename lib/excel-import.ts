import { strFromU8, unzipSync } from "fflate";
import { emptySpecimen, specimenFields, type SpecimenData } from "./specimen-fields";

type CellValue = string | number | boolean | Date | null;
type WorksheetRow = CellValue[];

type WorkbookSheet = {
  name: string;
  rows: WorksheetRow[];
};

export type ParsedImportRow = {
  data: SpecimenData;
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

const noteOnlyHeaders = new Set([
  "accessedfrom",
  "dateofextraction",
  "domain",
  "kingdom",
  "strain",
  "source",
  "sourcedataset",
]);

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
    sheets.push({ name, rows: readWorksheetRows(worksheet, sharedStrings) });
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

function findHeaderRow(rows: WorksheetRow[]): number {
  const maxRows = Math.min(rows.length, 20);
  let bestIndex = -1;
  let bestScore = 0;
  for (let index = 0; index < maxRows; index += 1) {
    const row = rows[index] ?? [];
    const normalized = row.map(normalizeHeader);
    const score = normalized.filter((header) => fieldAliases[header] || header === "coordinates" || noteOnlyHeaders.has(header)).length;
    const hasPrimaryId = normalized.some((header) => fieldAliases[header] === "specimenNo");
    if (score > bestScore && (hasPrimaryId || score >= 4)) {
      bestScore = score;
      bestIndex = index;
    }
  }
  return bestScore >= 2 ? bestIndex : -1;
}

function parseSheetRows(sheetName: string, rows: WorksheetRow[]): ParsedImportRow[] {
  const headerIndex = findHeaderRow(rows);
  if (headerIndex < 0) return [];

  const headers = rows[headerIndex].map(cellToText);
  const parsed: ParsedImportRow[] = [];

  for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const sourceRow = rows[rowIndex] ?? [];
    const data = emptySpecimen();
    let recognizedValueCount = 0;

    for (let columnIndex = 0; columnIndex < headers.length; columnIndex += 1) {
      const header = headers[columnIndex];
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
        appendNote(data, `${header}: ${value}`);
        recognizedValueCount += 1;
      }
    }

    if (recognizedValueCount === 0) continue;
    const meaningfulValues = Object.values(data).filter((value) => String(value).trim());
    if (meaningfulValues.length === 0) continue;

    parsed.push({ data, sourceSheet: sheetName, sourceRow: rowIndex + 1 });
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
    const parsed = parseSheetRows(sheet.name, sheet.rows);
    if (parsed.length === 0) {
      warnings.push(`Sheet “${sheet.name}” did not contain a normal row-based specimen table and was skipped.`);
      continue;
    }

    const hasMergedRecords = parsed.some((item) => {
      const identifiers = item.data.specimenNo.match(/\b(?:SRA|AUTO)-[A-Z0-9-]+\b/gi) ?? [];
      return identifiers.length > 1;
    });
    if (hasMergedRecords) {
      warnings.push(`Sheet “${sheet.name}” appears to contain several specimens merged into one cell row. Use the normalized registry-import workbook instead.`);
      continue;
    }

    rows.push(...parsed);
  }

  if (rows.length === 0) {
    warnings.push("No importable specimen rows were found. The workbook may contain the table as drawing objects instead of editable cells.");
  }

  return { rows, warnings };
}
