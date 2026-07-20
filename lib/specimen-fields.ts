export type FieldType = "text" | "date" | "number" | "textarea" | "select";

export type SpecimenField = {
  key: string;
  label: string;
  group: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  step?: string;
};

export const fieldGroups = [
  "Accession & verification",
  "Collection location",
  "Ecology & host",
  "Taxonomy",
  "Specimen details",
  "Status & references",
] as const;

export const specimenFields: SpecimenField[] = [
  { key: "specimenNo", label: "Specimen No.", group: "Accession & verification", type: "text", required: true, placeholder: "e.g. VIPM-2026-0001" },
  { key: "dateCollection", label: "Date of collection", group: "Accession & verification", type: "date" },
  { key: "speciesId", label: "Species ID", group: "Accession & verification", type: "text" },
  { key: "verifiedId", label: "Verified ID", group: "Accession & verification", type: "text" },
  { key: "dateVerification", label: "Date of verification", group: "Accession & verification", type: "date" },
  { key: "meansVerification", label: "Means of verification", group: "Accession & verification", type: "select", options: ["Morphological examination", "Microscopy", "DNA barcoding", "Expert confirmation", "Reference collection comparison", "Field identification", "Other"] },

  { key: "country", label: "Country", group: "Collection location", type: "text", placeholder: "Philippines" },
  { key: "region", label: "Region", group: "Collection location", type: "text" },
  { key: "province", label: "Province", group: "Collection location", type: "text" },
  { key: "locality", label: "Locality", group: "Collection location", type: "text" },
  { key: "elevation", label: "Elevation (m)", group: "Collection location", type: "number", step: "0.01" },
  { key: "longitude", label: "Longitude", group: "Collection location", type: "number", step: "0.000001" },
  { key: "latitude", label: "Latitude", group: "Collection location", type: "number", step: "0.000001" },

  { key: "habitat", label: "Habitat", group: "Ecology & host", type: "textarea", placeholder: "Describe the field, crop environment, soil, canopy, microhabitat, etc." },
  { key: "hostPlantVariety", label: "Host Plant and Variety", group: "Ecology & host", type: "text" },
  { key: "lastFound", label: "Last found", group: "Ecology & host", type: "date" },
  { key: "trophicGuild", label: "Trophic guild", group: "Ecology & host", type: "select", options: ["Herbivore", "Predator", "Parasitoid", "Pollinator", "Detritivore", "Fungivore", "Omnivore", "Pathogen", "Other"] },
  { key: "hostPreyFood", label: "Host / Prey / Food", group: "Ecology & host", type: "textarea" },
  { key: "possiblePredator", label: "Possible predator", group: "Ecology & host", type: "text", placeholder: "Optional; enter only a supported or observed relationship" },

  { key: "phylum", label: "Phylum", group: "Taxonomy", type: "text" },
  { key: "subphylum", label: "Subphylum", group: "Taxonomy", type: "text" },
  { key: "className", label: "Class", group: "Taxonomy", type: "text" },
  { key: "subclass", label: "Subclass", group: "Taxonomy", type: "text" },
  { key: "orderName", label: "Order", group: "Taxonomy", type: "text" },
  { key: "subOrder", label: "Sub-order", group: "Taxonomy", type: "text" },
  { key: "superfamily", label: "Superfamily", group: "Taxonomy", type: "text" },
  { key: "family", label: "Family", group: "Taxonomy", type: "text" },
  { key: "subFamily", label: "Sub-family", group: "Taxonomy", type: "text" },
  { key: "tribe", label: "Tribe", group: "Taxonomy", type: "text" },
  { key: "genus", label: "Genus", group: "Taxonomy", type: "text" },
  { key: "subgenus", label: "Subgenus", group: "Taxonomy", type: "text" },
  { key: "species", label: "Species", group: "Taxonomy", type: "text" },
  { key: "subspecies", label: "Subspecies", group: "Taxonomy", type: "text" },
  { key: "authority", label: "Authority", group: "Taxonomy", type: "text" },
  { key: "year", label: "Year", group: "Taxonomy", type: "number", step: "1" },

  { key: "lifeStage", label: "Life stage", group: "Specimen details", type: "select", options: ["Egg", "Larva", "Nymph", "Pupa", "Adult", "Multiple stages", "Unknown"] },
  { key: "numberSamples", label: "Number of samples", group: "Specimen details", type: "number", step: "1" },
  { key: "commonName", label: "Common Name", group: "Specimen details", type: "text" },
  { key: "collectorsName", label: "Collector's Name", group: "Specimen details", type: "text" },
  { key: "sampleStatus", label: "Sample Status", group: "Specimen details", type: "select", options: ["Collected", "In examination", "Awaiting verification", "Verified", "Preserved", "On loan", "Damaged", "Missing", "Archived"] },

  { key: "conservationStatus", label: "Conservation Status", group: "Status & references", type: "select", options: ["Not evaluated", "Data deficient", "Least concern", "Near threatened", "Vulnerable", "Endangered", "Critically endangered", "Extinct in the wild", "Extinct", "Other"] },
  { key: "taxonomicStatus", label: "Taxonomic Status", group: "Status & references", type: "select", options: ["Accepted", "Provisionally accepted", "Unresolved", "Synonym", "Misidentification", "Needs review"] },
  { key: "reference", label: "Reference", group: "Status & references", type: "textarea", placeholder: "Publication, catalogue, URL, accession, or expert reference" },
  { key: "notes", label: "Additional notes", group: "Status & references", type: "textarea" },
];

export const photoSlots = [
  { key: "front", label: "Front view" },
  { key: "side", label: "Side view" },
  { key: "dorsal", label: "Dorsal / top view" },
  { key: "ventral", label: "Ventral / bottom view" },
  { key: "label", label: "Specimen label" },
  { key: "habitatPhoto", label: "Habitat / host plant" },
  { key: "other", label: "Other view" },
] as const;

export type SpecimenData = Record<string, string>;

export function emptySpecimen(): SpecimenData {
  return Object.fromEntries(specimenFields.map((field) => [field.key, ""]));
}

export function displayScientificName(data: SpecimenData): string {
  const name = [data.genus, data.species, data.subspecies].filter(Boolean).join(" ");
  return name || data.verifiedId || data.speciesId || "Unidentified specimen";
}

export function buildSearchText(data: SpecimenData, creatorName: string, creatorEmail: string): string {
  const fieldValues = specimenFields.flatMap((field) => [field.label, data[field.key] || ""]);
  return [...fieldValues, creatorName, creatorEmail].join(" ").replace(/\s+/g, " ").trim().toLowerCase();
}
