import { describe, expect, it } from "vitest";
import { SAM } from "../../../test/fixtures/profiles";
import { maskDocumentNumber, redactProfile } from "./redact";

describe("maskDocumentNumber", () => {
  it("keeps only the last 4 characters", () => {
    expect(maskDocumentNumber("X12345678")).toBe("••••5678");
  });

  it("fully masks short numbers", () => {
    expect(maskDocumentNumber("1234")).toBe("••••");
  });

  it("is idempotent", () => {
    expect(maskDocumentNumber(maskDocumentNumber("X12345678"))).toBe("••••5678");
  });
});

describe("redactProfile", () => {
  it("masks document numbers and leaves everything else alone", () => {
    const redacted = redactProfile(SAM);
    expect(redacted.travelDocuments[0]).toEqual({
      documentName: "Passport",
      documentNumber: "••••5678",
      nameOnDocument: "Sam Lee",
    });
    expect({ ...redacted, travelDocuments: [] }).toEqual({ ...SAM, travelDocuments: [] });
    expect(JSON.stringify(redacted)).not.toContain("X12345678");
  });

  it("does not mutate the input", () => {
    redactProfile(SAM);
    expect(SAM.travelDocuments[0].documentNumber).toBe("X12345678");
  });
});
