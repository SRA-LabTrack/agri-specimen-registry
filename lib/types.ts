import type { Models } from "appwrite";
import type { SpecimenData } from "./specimen-fields";

export type PhotoMap = Record<string, string>;

export type SpecimenRow = Models.Row & {
  specimenNo: string;
  speciesId?: string;
  verifiedId?: string;
  dateCollection?: string;
  dateVerification?: string;
  family?: string;
  genus?: string;
  species?: string;
  commonName?: string;
  sampleStatus?: string;
  conservationStatus?: string;
  taxonomicStatus?: string;
  createdById: string;
  createdByName: string;
  createdByEmail: string;
  dataJson: string;
  photoJson?: string;
  searchText: string;
};

export function parseSpecimenData(row: SpecimenRow): SpecimenData {
  try {
    return JSON.parse(row.dataJson || "{}") as SpecimenData;
  } catch {
    return {};
  }
}

export function parsePhotoMap(row: SpecimenRow): PhotoMap {
  try {
    return JSON.parse(row.photoJson || "{}") as PhotoMap;
  } catch {
    return {};
  }
}
