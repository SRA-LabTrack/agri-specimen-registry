import fs from "node:fs";
import path from "node:path";
import * as sdk from "node-appwrite";

function loadEnvFile(filename) {
  const fullPath = path.resolve(process.cwd(), filename);
  if (!fs.existsSync(fullPath)) return;
  for (const rawLine of fs.readFileSync(fullPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index < 1) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    value = value.replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "agri-registry";
const tableId = process.env.NEXT_PUBLIC_APPWRITE_TABLE_ID || "specimens";
const bucketId = process.env.NEXT_PUBLIC_APPWRITE_BUCKET_ID || "specimen-photos";

if (!endpoint || !projectId || !apiKey) {
  console.error("\nMissing Appwrite values. Copy .env.example to .env.local and fill in:");
  console.error("NEXT_PUBLIC_APPWRITE_ENDPOINT, NEXT_PUBLIC_APPWRITE_PROJECT_ID, and APPWRITE_API_KEY\n");
  process.exit(1);
}

const client = new sdk.Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const tablesDB = new sdk.TablesDB(client);
const storage = new sdk.Storage(client);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isConflict = (error) => error?.code === 409 || error?.response?.code === 409;

async function ensureResource(label, create) {
  try {
    await create();
    console.log(`✓ Created ${label}`);
  } catch (error) {
    if (isConflict(error)) {
      console.log(`• ${label} already exists`);
      return;
    }
    throw error;
  }
}

async function waitForColumn(key) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const column = await tablesDB.getColumn({ databaseId, tableId, key });
      if (column.status === "available") return;
      if (column.status === "failed") throw new Error(`Column ${key} failed: ${column.error || "unknown error"}`);
    } catch (error) {
      if (error?.code !== 404) throw error;
    }
    await sleep(750);
  }
  throw new Error(`Timed out while waiting for column ${key}.`);
}

async function waitForIndex(key) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const index = await tablesDB.getIndex({ databaseId, tableId, key });
      if (index.status === "available") return;
      if (index.status === "failed") throw new Error(`Index ${key} failed: ${index.error || "unknown error"}`);
    } catch (error) {
      if (error?.code !== 404) throw error;
    }
    await sleep(750);
  }
  throw new Error(`Timed out while waiting for index ${key}.`);
}

const varcharColumns = [
  ["specimenNo", 120, true],
  ["speciesId", 180, false],
  ["verifiedId", 180, false],
  ["family", 180, false],
  ["genus", 180, false],
  ["species", 180, false],
  ["commonName", 180, false],
  ["sampleStatus", 80, false],
  ["conservationStatus", 120, false],
  ["taxonomicStatus", 120, false],
  ["createdById", 36, true],
  ["createdByName", 180, true],
  ["createdByEmail", 320, true],
];

const datetimeColumns = ["dateCollection", "dateVerification"];
const textColumns = ["dataJson", "photoJson", "searchText"];

async function main() {
  console.log("\nSetting up AgriSpecimen in Appwrite...\n");

  await ensureResource(`database '${databaseId}'`, () => tablesDB.create({
    databaseId,
    name: "AgriSpecimen Registry",
    enabled: true,
  }));

  await ensureResource(`table '${tableId}'`, () => tablesDB.createTable({
    databaseId,
    tableId,
    name: "Specimens",
    permissions: [
      sdk.Permission.read(sdk.Role.users()),
      sdk.Permission.create(sdk.Role.users()),
    ],
    rowSecurity: true,
    enabled: true,
  }));

  for (const [key, size, required] of varcharColumns) {
    await ensureResource(`column '${key}'`, () => tablesDB.createVarcharColumn({
      databaseId,
      tableId,
      key,
      size,
      required,
      array: false,
      encrypt: false,
    }));
    await waitForColumn(key);
  }

  for (const key of datetimeColumns) {
    await ensureResource(`column '${key}'`, () => tablesDB.createDatetimeColumn({
      databaseId,
      tableId,
      key,
      required: false,
      array: false,
    }));
    await waitForColumn(key);
  }

  for (const key of textColumns) {
    await ensureResource(`column '${key}'`, () => tablesDB.createTextColumn({
      databaseId,
      tableId,
      key,
      required: key === "dataJson" || key === "searchText",
      array: false,
      encrypt: false,
    }));
    await waitForColumn(key);
  }

  const indexes = [
    ["specimen_no_unique", "unique", ["specimenNo"]],
    ["search_text_fulltext", "fulltext", ["searchText"]],
    ["family_key", "key", ["family"]],
    ["genus_key", "key", ["genus"]],
    ["species_key", "key", ["species"]],
    ["status_key", "key", ["sampleStatus"]],
    ["creator_key", "key", ["createdById"]],
  ];

  for (const [key, type, columns] of indexes) {
    await ensureResource(`index '${key}'`, () => tablesDB.createIndex({
      databaseId,
      tableId,
      key,
      type,
      columns,
    }));
    await waitForIndex(key);
  }

  await ensureResource(`storage bucket '${bucketId}'`, () => storage.createBucket({
    bucketId,
    name: "Specimen Photos",
    permissions: [sdk.Permission.create(sdk.Role.users())],
    fileSecurity: true,
    enabled: true,
    maximumFileSize: 20 * 1024 * 1024,
    allowedFileExtensions: ["jpg", "jpeg", "png", "webp"],
    compression: "none",
    encryption: true,
    antivirus: true,
    transformations: true,
  }));

  console.log("\n✓ Appwrite setup complete.");
  console.log("Delete the temporary API key from Appwrite, then run: npm run dev\n");
}

main().catch((error) => {
  console.error("\nSetup failed:", error?.message || error);
  if (error?.response) console.error(error.response);
  process.exit(1);
});
