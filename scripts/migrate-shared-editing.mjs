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
  console.error("\nMissing Appwrite values in .env.local:");
  console.error("NEXT_PUBLIC_APPWRITE_ENDPOINT, NEXT_PUBLIC_APPWRITE_PROJECT_ID, and APPWRITE_API_KEY\n");
  process.exit(1);
}

const client = new sdk.Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const tablesDB = new sdk.TablesDB(client);
const storage = new sdk.Storage(client);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isNotFound = (error) => error?.code === 404 || error?.response?.code === 404;
const isConflict = (error) => error?.code === 409 || error?.response?.code === 409;

async function waitForIndex(key) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const index = await tablesDB.getIndex({ databaseId, tableId, key });
      if (index.status === "available") return;
      if (index.status === "failed") throw new Error(`Index ${key} failed: ${index.error || "unknown error"}`);
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }
    await sleep(750);
  }
  throw new Error(`Timed out while waiting for index ${key}.`);
}


async function waitForIndexDeletion(key) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      await tablesDB.getIndex({ databaseId, tableId, key });
    } catch (error) {
      if (isNotFound(error)) return;
      throw error;
    }
    await sleep(750);
  }
  throw new Error(`Timed out while removing index ${key}.`);
}

async function removeLegacyUniqueIndex() {
  try {
    await tablesDB.getIndex({ databaseId, tableId, key: "specimen_no_unique" });
    await tablesDB.deleteIndex({ databaseId, tableId, key: "specimen_no_unique" });
    await waitForIndexDeletion("specimen_no_unique");
    console.log("✓ Removed the old unique Specimen No. index");
  } catch (error) {
    if (isNotFound(error)) console.log("• Old unique Specimen No. index was already removed");
    else throw error;
  }
}

async function ensureSearchableSpecimenIndex() {
  try {
    await tablesDB.createIndex({
      databaseId,
      tableId,
      key: "specimen_no_key",
      type: "key",
      columns: ["specimenNo"],
    });
    console.log("✓ Created the non-unique Specimen No. lookup index");
  } catch (error) {
    if (isConflict(error)) console.log("• Non-unique Specimen No. lookup index already exists");
    else throw error;
  }
  await waitForIndex("specimen_no_key");
}

async function enableSharedRowEditing() {
  const table = await tablesDB.getTable({ databaseId, tableId });
  await tablesDB.updateTable({
    databaseId,
    tableId,
    name: table.name,
    permissions: [
      sdk.Permission.read(sdk.Role.users()),
      sdk.Permission.create(sdk.Role.users()),
      sdk.Permission.update(sdk.Role.users()),
      sdk.Permission.delete(sdk.Role.users()),
    ],
    rowSecurity: true,
    enabled: table.enabled,
    purge: true,
  });
  console.log("✓ Every signed-in member can now update every specimen row");
}

async function enableSharedPhotoEditing() {
  const bucket = await storage.getBucket({ bucketId });
  await storage.updateBucket({
    bucketId,
    name: bucket.name,
    permissions: [
      sdk.Permission.read(sdk.Role.users()),
      sdk.Permission.create(sdk.Role.users()),
      sdk.Permission.update(sdk.Role.users()),
      sdk.Permission.delete(sdk.Role.users()),
    ],
    fileSecurity: true,
    enabled: bucket.enabled,
  });
  console.log("✓ Every signed-in member can now replace or remove specimen photos");
}

async function main() {
  console.log("\nMigrating AgriSpecimen permissions and duplicate handling...\n");
  await removeLegacyUniqueIndex();
  await ensureSearchableSpecimenIndex();
  await enableSharedRowEditing();
  await enableSharedPhotoEditing();
  console.log("\n✓ Migration complete. Delete the temporary Appwrite API key from .env.local and from the Appwrite Console.\n");
}

main().catch((error) => {
  console.error("\nMigration failed:", error?.message || error);
  if (error?.response) console.error(error.response);
  process.exit(1);
});
