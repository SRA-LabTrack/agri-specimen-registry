import { Account, Client, Storage, TablesDB } from "appwrite";

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "";
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || "";

export const APPWRITE_DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "agri-registry";
export const APPWRITE_TABLE_ID = process.env.NEXT_PUBLIC_APPWRITE_TABLE_ID || "specimens";
export const APPWRITE_BUCKET_ID = process.env.NEXT_PUBLIC_APPWRITE_BUCKET_ID || "specimen-photos";

export const appwriteConfigured = Boolean(endpoint && projectId);

export const client = new Client();
if (appwriteConfigured) {
  client.setEndpoint(endpoint).setProject(projectId);
}

export const account = new Account(client);
export const tablesDB = new TablesDB(client);
export const storage = new Storage(client);
