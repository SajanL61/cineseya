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

export function tmdbPersonIdFrom(value: string) {
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return trimmed;
  return trimmed.match(/themoviedb\.org\/person\/(\d+)/i)?.[1];
}

function linkedName(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/\*\*|__|`/g, "")
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 10)),
    )
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractTmdbPersonIds(value: string) {
  const people: Record<string, string> = {};
  const add = (rawName: string, personId: string) => {
    const name = linkedName(rawName);
    const key = normalizeCreditName(name);
    if (key && !ignoredVisualLabel.test(name)) people[key] = personId;
  };
  const markdown = /\[([^\]]+)\]\([^)]*themoviedb\.org\/person\/(\d+)[^)]*\)/gi;
  for (const match of value.matchAll(markdown)) add(match[1], match[2]);
  const html = /<a\b[^>]*href=["'][^"']*\/person\/(\d+)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of value.matchAll(html)) add(match[2], match[1]);
  return people;
}

export function addTmdbPersonIdsToCredits(
  value: string,
  people: Record<string, string>,
) {
  return value
    .split("\n")
    .map((line) => {
      const parts = line.split("|").map((part) => part.trim());
      const personId = people[normalizeCreditName(parts[0] ?? "")];
      const hasPersonId =
        parts.length >= 3 && Boolean(tmdbPersonIdFrom(parts.at(-1) ?? ""));
      return personId && !hasPersonId ? `${line.trim()} | ${personId}` : line;
    })
    .join("\n");
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
  const credits: string[] = [];
  const positions = new Map<string, number>();
  for (const rawLine of value.replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const [rawName, ...rawDetails] = line.split("|");
    const name = rawName.trim();
    const nextPersonId =
      rawDetails.length >= 2
        ? tmdbPersonIdFrom(rawDetails.at(-1) ?? "")
        : undefined;
    if (nextPersonId) rawDetails.pop();
    const detail = rawDetails.join(" | ").trim();
    const key = normalizeCreditName(name);
    if (!key) continue;
    const formatted = rawDetails.length
      ? `${name} | ${detail}${nextPersonId ? ` | ${nextPersonId}` : ""}`
      : name;
    const existingPosition = positions.get(key);
    if (existingPosition === undefined) {
      positions.set(key, credits.length);
      credits.push(formatted);
      continue;
    }
    const [, ...existingDetails] = credits[existingPosition].split("|");
    const existingPersonId =
      existingDetails.length >= 2
        ? tmdbPersonIdFrom(existingDetails.at(-1) ?? "")
        : undefined;
    if (existingPersonId) existingDetails.pop();
    const existingDetail = existingDetails.join(" | ").trim();
    const existingIsUseful =
      existingDetail &&
      normalizeCreditName(existingDetail) !== key &&
      !ignoredVisualLabel.test(existingDetail);
    const nextIsUseful =
      detail &&
      normalizeCreditName(detail) !== key &&
      !ignoredVisualLabel.test(detail);
    if (!existingIsUseful && nextIsUseful)
      credits[existingPosition] = `${name} | ${detail}${nextPersonId ? ` | ${nextPersonId}` : ""}`;
    else if (!existingPersonId && nextPersonId)
      credits[existingPosition] = `${credits[existingPosition].trim()} | ${nextPersonId}`;
  }
  return credits.join("\n");
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
  const people = extractTmdbPersonIds(value);
  const lines = copiedLines(value, kind);
  if (!lines.length) return "";
  if (lines.some((line) => line.includes("|")))
    return addTmdbPersonIdsToCredits(
      dedupeCreditLines(
        lines
          .filter(
            (line) =>
              kind !== "crew" ||
              !crewDepartments.has(line.toLocaleLowerCase()),
          )
          .map((line) => (line.includes("|") ? line : `${line} | `))
          .join("\n"),
      ),
      people,
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
  return addTmdbPersonIdsToCredits(
    dedupeCreditLines(credits.join("\n")),
    people,
  );
}
