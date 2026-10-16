import { describe, expect, it } from "vitest";
import {
  addTmdbPersonIdsToCredits,
  dedupeCreditLines,
  extractTmdbPersonIds,
  formatCreditPaste,
} from "../src/lib/client/credit-paste";

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

  it("removes TMDB image links and duplicate linked names", () => {
    const copied = `1. [Zachary Levi](https://www.themoviedb.org/person/69899-zachary-levi)

   &#x20;([image](https://media.themoviedb.org/t/p/w66_and_h66_face/zachary.jpg))

   [**Zachary Levi**](https://www.themoviedb.org/person/69899-zachary-levi)

   Tucker
2. [Liam Neeson](https://www.themoviedb.org/person/3896-liam-neeson)

   &#x20;([image](https://media.themoviedb.org/t/p/w66_and_h66_face/liam.jpg))

   [**Liam Neeson**](https://www.themoviedb.org/person/3896-liam-neeson)

   Larry`;

    expect(formatCreditPaste(copied, "cast")).toBe(
      "Zachary Levi | Tucker | 69899\nLiam Neeson | Larry | 3896",
    );
  });

  it("keeps person IDs from TMDB HTML clipboard links", () => {
    const html = `<a href="https://www.themoviedb.org/person/69899-zachary-levi"><img alt="Zachary Levi"></a><a href="/person/69899-zachary-levi"><bdi>Zachary Levi</bdi></a>`;
    const formatted = formatCreditPaste(
      "Zachary Levi\nZachary Levi\nTucker",
      "cast",
    );
    expect(
      addTmdbPersonIdsToCredits(formatted, extractTmdbPersonIds(html)),
    ).toBe("Zachary Levi | Tucker | 69899");
  });

  it("ignores standalone image labels between duplicate TMDB names", () => {
    expect(
      formatCreditPaste(
        "Zachary Levi\nimage\nZachary Levi\nTucker\nLiam Neeson\nphoto\nLiam Neeson\nLarry",
        "cast",
      ),
    ).toBe("Zachary Levi | Tucker\nLiam Neeson | Larry");
  });

  it("never keeps the same formatted person twice", () => {
    expect(
      dedupeCreditLines(
        "Zachary Levi | \nZachary Levi | Tucker\nLiam Neeson | Larry\nZachary Levi | Tucker",
      ),
    ).toBe("Zachary Levi | Tucker\nLiam Neeson | Larry");
  });

  it("upgrades an existing credit when a repeated paste includes a person ID", () => {
    expect(
      dedupeCreditLines(
        "Zachary Levi | Tucker\nZachary Levi | Tucker | 69899",
      ),
    ).toBe("Zachary Levi | Tucker | 69899");
  });

  it("preserves non-Latin names while removing their duplicates", () => {
    expect(
      dedupeCreditLines("සමන් පෙරේරා | චරිතය\nසමන් පෙරේරා | චරිතය"),
    ).toBe("සමන් පෙරේරා | චරිතය");
  });
});
