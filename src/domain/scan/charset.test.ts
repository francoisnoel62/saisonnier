import { expect, it } from "vitest"

import { declaredCharset, decodeBody } from "./charset"

it.each([
  ["text/html; charset=ISO-8859-1", "", "iso-8859-1"],
  ['text/html; charset="windows-1252"', "", "windows-1252"],
  ["text/html", '<meta charset="iso-8859-1">', "iso-8859-1"],
  [
    "text/html",
    '<meta http-equiv="Content-Type" content="text/html; charset=windows-1252">',
    "windows-1252",
  ],
  [
    "application/rss+xml",
    '<?xml version="1.0" encoding="ISO-8859-15"?>',
    "iso-8859-15",
  ],
  ["text/html", "<html>", "utf-8"],
])("%s + %s → %s", (header, head, expected) => {
  expect(declaredCharset(header, head)).toBe(expected)
})

it("décode une page Latin-1 sans perdre les accents", () => {
  const bytes = Buffer.from("Saisonnière été", "latin1")
  expect(decodeBody(bytes, "iso-8859-1")).toBe("Saisonnière été")
})

it("refuse un jeu de caractères inconnu", () => {
  expect(decodeBody(Buffer.from("x"), "x-inconnu")).toBeNull()
})
