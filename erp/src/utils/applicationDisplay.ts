export type ApplicationDisplayLike = {
  beneficiary?: { name?: string | null; phone?: string | null } | null;
  scheme?: { name?: string | null } | null;
  project?: { name?: string | null } | null;
  district?: { name?: string | null } | null;
  area?: { name?: string | null } | null;
};

export const textOrFallback = (value?: string | null, fallback: string = "N/A"): string => {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized.length > 0 ? normalized : fallback;
};

export const getApplicationDisplay = (application?: ApplicationDisplayLike | null) => ({
  beneficiaryName: textOrFallback(application?.beneficiary?.name, "Unknown beneficiary"),
  beneficiaryPhone: textOrFallback(application?.beneficiary?.phone),
  schemeName: textOrFallback(application?.scheme?.name),
  projectName: textOrFallback(application?.project?.name),
  districtName: textOrFallback(application?.district?.name),
  areaName: textOrFallback(application?.area?.name),
});
