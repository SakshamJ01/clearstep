import { describe, expect, it } from "vitest";
import { containsCrisisLanguage } from "@/lib/safety";

describe("containsCrisisLanguage", () => {
  it.each([
    "I keep thinking I want to die.",
    "Sometimes I think everyone would be better off dead.",
    "I have been cutting myself again.",
    "I am planning to end my life.",
    "I might kill myself tonight.",
    "There is no reason to live.",
  ])("detects direct crisis language: %s", (text) => {
    expect(containsCrisisLanguage(text)).toBe(true);
  });

  it.each([
    "I need to call the dentist and sort out the flat.",
    "This deadline is killing me but I need a plan.",
    "I am dying to get this off my plate.",
    "The project is suicidal for my sleep schedule.",
    "I want to kill the remaining tasks quickly.",
  ])("does not flag ordinary planning language: %s", (text) => {
    expect(containsCrisisLanguage(text)).toBe(false);
  });
});
