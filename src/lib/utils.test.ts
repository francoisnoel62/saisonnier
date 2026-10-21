import { describe, expect, it } from "vitest"

import { cn } from "./utils"

describe("cn", () => {
  it("fusionne les classes et ignore les valeurs fausses", () => {
    expect(cn("px-2", false && "hidden", undefined, "py-1")).toBe("px-2 py-1")
  })

  it("laisse la dernière classe Tailwind l'emporter en cas de conflit", () => {
    expect(cn("px-2", "px-4")).toBe("px-4")
  })
})
