export type CreditKind = "cast" | "crew";

const crewDepartments = new Set(
  [
    "Acting",
    "Art",
    "Camera",
    "Costume & Make-Up",
    "Costume & Makeup",
    "Creator",
    "Crew",
    "Directing",
    "Editing",
    "Lighting",
    "Production",
    "Sound",
    "Visual Effects",
    "Writing",
  ].map((department) => department.toLocaleLowerCase()),
);

const sectionPattern = (kind: CreditKind) =>
  new RegExp(`^${kind}(?:\\s*\\d+)?$`, "i");

const ignoredVisualLabel = /^(?:[\[(]\s*)?(?:image|photo|profile image|profile photo|no image)(?:\s*[\])])?$/i;
const normalizeCreditName = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

export function profileImageUrlFrom(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function cleanCopiedLine(line: string) {
  if (/\[image\]\(|media\.themoviedb\.org/i.test(line)) return "";
  const cleaned = line
    .replace(/\u00a0|&#x20;|&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .trim()
    .replace(/^\d+\.\s*/, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*|__|`/g, "")
    .replace(/<[^>]*>/g, "")
    .trim();
  return ignoredVisualLabel.test(cleaned) || /^https?:\/\/\S+$/i.test(cleaned)
    ? ""
    : cleaned;
}

export function dedupeCreditLines(value: string) {
  const credits: Array<{
    name: string;
    detail: string;
    hasDetailColumn: boolean;
    profileUrl?: string;
  }> = [];
  const positions = new Map<string, number>();
  for (const rawLine of value.replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const [rawName, ...rawDetails] = line.split("|");
    const name = rawName.trim();
    const profileUrl =
      rawDetails.length >= 2
        ? profileImageUrlFrom(rawDetails.at(-1) ?? "")
        : undefined;
    if (profileUrl) rawDetails.pop();
    if (
      rawDetails.length >= 2 &&
      /^\d+$/.test(rawDetails.at(-1)?.trim() ?? "")
    )
      rawDetails.pop();
    const detail = rawDetails.join(" | ").trim();
    const key = normalizeCreditName(name);
    if (!key) continue;
    const existingPosition = positions.get(key);
    if (existingPosition === undefined) {
      positions.set(key, credits.length);
      credits.push({
        name,
        detail,
        hasDetailColumn: rawDetails.length > 0,
        profileUrl,
      });
      continue;
    }
    const existing = credits[existingPosition];
    const existingIsUseful =
      existing.detail &&
      normalizeCreditName(existing.detail) !== key &&
      !ignoredVisualLabel.test(existing.detail);
    const nextIsUseful =
      detail &&
      normalizeCreditName(detail) !== key &&
      !ignoredVisualLabel.test(detail);
    if (!existingIsUseful && nextIsUseful) {
      existing.detail = detail;
      existing.hasDetailColumn = true;
    }
    if (!existing.profileUrl && profileUrl) existing.profileUrl = profileUrl;
  }
  return credits
    .map(
      ({ name, detail, hasDetailColumn, profileUrl }) =>
        `${name}${hasDetailColumn ? ` | ${detail}` : ""}${profileUrl ? ` | ${profileUrl}` : ""}`,
    )
    .join("\n");
}

function copiedLines(value: string, kind: CreditKind) {
  let lines = value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map(cleanCopiedLine)
    .filter(Boolean);
  const ownHeading = lines.findIndex((line) => sectionPattern(kind).test(line));
  if (ownHeading >= 0) lines = lines.slice(ownHeading + 1);
  if (/^\d+$/.test(lines[0] ?? "")) lines = lines.slice(1);
  const otherKind: CreditKind = kind === "cast" ? "crew" : "cast";
  const otherHeading = lines.findIndex((line) =>
    sectionPattern(otherKind).test(line),
  );
  if (otherHeading >= 0) lines = lines.slice(0, otherHeading);
  return lines;
}

export function formatCreditPaste(value: string, kind: CreditKind) {
  const lines = copiedLines(value, kind);
  if (!lines.length) return "";
  if (lines.some((line) => line.includes("|")))
    return dedupeCreditLines(
      lines
        .filter(
          (line) =>
            kind !== "crew" ||
            !crewDepartments.has(line.toLocaleLowerCase()),
        )
        .map((line) => (line.includes("|") ? line : `${line} | `))
        .join("\n"),
    );

  const credits: string[] = [];
  for (let index = 0; index < lines.length; ) {
    const name = lines[index++];
    if (
      kind === "crew" &&
      crewDepartments.has(name.toLocaleLowerCase())
    )
      continue;
    while (
      lines[index]?.toLocaleLowerCase() === name.toLocaleLowerCase()
    )
      index += 1;
    const detail = lines[index++] ?? "";
    credits.push(`${name} | ${detail}`);
  }
  return dedupeCreditLines(credits.join("\n"));
}
