import { describe, expect, it } from "vitest"

import {
  checkPdfDocument,
  contactDetailsSchema,
  displayFilename,
  documentKindFromSlug,
  DOCUMENT_MAX_BYTES,
  dossierStatus,
} from "./candidate-dossier"

describe("dossierStatus", () => {
  it("est complet avec un nom, un téléphone et un CV (H3)", () => {
    expect(
      dossierStatus({
        name: "Camille Candidat",
        phone: "06 39 98 12 34",
        cvPathname: "candidates/u1/cv-a1b2.pdf",
      }),
    ).toEqual({ complete: true, missing: [] })
  })

  it("liste ce qui manque, dans l'ordre", () => {
    expect(dossierStatus({ name: "Camille" })).toEqual({
      complete: false,
      missing: ["phone", "cv"],
    })
    expect(dossierStatus({})).toEqual({
      complete: false,
      missing: ["name", "phone", "cv"],
    })
  })

  it("ne compte pas un texte fait d'espaces", () => {
    expect(
      dossierStatus({ name: "  ", phone: " ", cvPathname: "" }).missing,
    ).toEqual(["name", "phone", "cv"])
  })

  it("n'exige ni lettre ni message", () => {
    expect(
      dossierStatus({ name: "A", phone: "0639981234", cvPathname: "x" })
        .complete,
    ).toBe(true)
  })
})

const pdfHead = new TextEncoder().encode("%PDF-1.7")

describe("checkPdfDocument", () => {
  it("accepte un PDF de 4 Mo au plus", () => {
    expect(
      checkPdfDocument({ type: "application/pdf", size: 1200, head: pdfHead }),
    ).toBeNull()
    expect(
      checkPdfDocument({
        type: "application/pdf",
        size: DOCUMENT_MAX_BYTES,
        head: pdfHead,
      }),
    ).toBeNull()
  })

  it("refuse un fichier qui dépasse 4 Mo", () => {
    expect(
      checkPdfDocument({
        type: "application/pdf",
        size: DOCUMENT_MAX_BYTES + 1,
        head: pdfHead,
      }),
    ).toMatchObject({
      reason: "too_large",
      message: expect.stringMatching(/4 Mo/),
    })
  })

  it("exige le type déclaré et la signature %PDF-", () => {
    const word = new TextEncoder().encode("PK\x03\x04")
    expect(
      checkPdfDocument({ type: "application/pdf", size: 1200, head: word }),
    ).toMatchObject({ reason: "not_pdf" })
    expect(
      checkPdfDocument({ type: "text/plain", size: 1200, head: pdfHead }),
    ).toMatchObject({ reason: "not_pdf" })
    expect(
      checkPdfDocument({
        type: "application/pdf",
        size: 1200,
        head: new TextEncoder().encode("%PD"),
      }),
    ).toMatchObject({ reason: "not_pdf" })
  })

  it("refuse un fichier vide", () => {
    expect(
      checkPdfDocument({
        type: "application/pdf",
        size: 0,
        head: new Uint8Array(),
      }),
    ).toMatchObject({ reason: "empty" })
  })
})

describe("contactDetailsSchema", () => {
  it("accepte les numéros français et étrangers", () => {
    for (const phone of [
      "06 39 98 12 34",
      "0639981234",
      "+33 6 39 98 12 34",
      "+41 (0)79 123 45 67",
      "06.39.98.12.34",
    ]) {
      expect(
        contactDetailsSchema.safeParse({ name: "A", phone, city: "" }).success,
      ).toBe(true)
    }
  })

  it("refuse un numéro trop court ou qui contient des lettres", () => {
    for (const phone of ["0639", "06 39 98 AB CD", "appelez-moi"]) {
      expect(
        contactDetailsSchema.safeParse({ name: "A", phone, city: "" }).success,
      ).toBe(false)
    }
  })

  it("écrit null un champ facultatif laissé vide", () => {
    expect(
      contactDetailsSchema.parse({ name: " Camille ", phone: " ", city: "" }),
    ).toEqual({ name: "Camille", phone: null, city: null })
  })

  it("exige un nom", () => {
    expect(
      contactDetailsSchema.safeParse({ name: "  ", phone: "", city: "" })
        .success,
    ).toBe(false)
  })
})

describe("documents", () => {
  it("lit le type de document dans l'URL", () => {
    expect(documentKindFromSlug("cv")).toBe("cv")
    expect(documentKindFromSlug("lettre")).toBe("cover_letter")
    expect(documentKindFromSlug("cover_letter")).toBeNull()
    expect(documentKindFromSlug(null)).toBeNull()
  })

  it("nettoie le nom de fichier affiché", () => {
    expect(displayFilename("C:\\Users\\moi\\Mon CV.pdf", "cv")).toBe(
      "Mon CV.pdf",
    )
    expect(displayFilename('cv"\n.pdf', "cv")).toBe("cv.pdf")
    expect(displayFilename("   ", "cover_letter")).toBe("lettre.pdf")
  })
})
