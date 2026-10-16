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

function cleanCopiedLine(line: string) {
  if (/\[image\]\(|media\.themoviedb\.org/i.test(line)) return "";
  return line
    .replace(/\u00a0|&#x20;|&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .trim()
    .replace(/^\d+\.\s*/, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*|__|`/g, "")
    .replace(/<[^>]*>/g, "")
    .trim();
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
    return lines
      .filter(
        (line) =>
          kind !== "crew" ||
          !crewDepartments.has(line.toLocaleLowerCase()),
      )
      .map((line) => (line.includes("|") ? line : `${line} | `))
      .join("\n");

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
  return credits.join("\n");
}
