import { describe, expect, it } from "vitest";
import { formatCreditPaste } from "../src/lib/client/credit-paste";

describe("formatCreditPaste", () => {
  it("combines copied cast names and characters", () => {
    expect(
      formatCreditPaste(
        "Cast 64\nZachary Levi\nTucker\nLiam Neeson\nLarry\nWes Chatham\nAlex",
        "cast",
      ),
    ).toBe(
      "Zachary Levi | Tucker\nLiam Neeson | Larry\nWes Chatham | Alex",
    );
  });

  it("combines crew names and jobs while ignoring department headings", () => {
    expect(
      formatCreditPaste(
        "Crew 28\nArt\nChristopher Stull\nProduction Design\nCamera\nLarry Smith\nDirector of Photography\nDirecting\nGuy Moshe\nDirector\nBrian Bettwy\nFirst Assistant Director",
        "crew",
      ),
    ).toBe(
      "Christopher Stull | Production Design\nLarry Smith | Director of Photography\nGuy Moshe | Director\nBrian Bettwy | First Assistant Director",
    );
  });

  it("keeps already formatted credits unchanged", () => {
    expect(
      formatCreditPaste(
        "Cary Grant | Walter Burns\nRosalind Russell | Hildy Johnson",
        "cast",
      ),
    ).toBe(
      "Cary Grant | Walter Burns\nRosalind Russell | Hildy Johnson",
    );
  });

  it("adds a separator to a single copied name", () => {
    expect(formatCreditPaste("Zachary Levi", "cast")).toBe(
      "Zachary Levi | ",
    );
  });
});
