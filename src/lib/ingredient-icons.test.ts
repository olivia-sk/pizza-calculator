import { describe, expect, it } from "vitest";
import { ingredientIcon } from "./ingredient-icons";

const JAR = "🫙";

describe("ingredientIcon", () => {
  it("gives the plain ingredients their own icon", () => {
    expect(ingredientIcon("Flour")).toBe("🌾");
    expect(ingredientIcon("Water")).toBe("💧");
    expect(ingredientIcon("Salt")).toBe("🧂");
    expect(ingredientIcon("Oil")).toBe("🫒");
    expect(ingredientIcon("Sugar / Honey / Malt")).toBe("🍯");
  });

  it("jars every leavening ingredient, yeast included", () => {
    expect(ingredientIcon("Sourdough Starter")).toBe(JAR);
    expect(ingredientIcon("Ripe Starter (100% hydration)")).toBe(JAR);
    expect(ingredientIcon("Poolish Preferment")).toBe(JAR);
    expect(ingredientIcon("Biga (Stiff Preferment)")).toBe(JAR);
    expect(ingredientIcon("Instant Dry Yeast")).toBe(JAR);
    expect(ingredientIcon("Active Dry Yeast")).toBe(JAR);
    expect(ingredientIcon("Fresh Yeast")).toBe(JAR);
  });

  it("ignores an ingredient named only inside a qualifier", () => {
    // The label carries the word "flour", but the ingredient is the starter.
    expect(ingredientIcon("Starter (% of total flour)")).toBe(JAR);
  });

  it("still falls back to a qualifier when nothing outside it matches", () => {
    expect(ingredientIcon("Hydration (water)")).toBe("💧");
  });

  it("resolves a compound label to its ingredient noun", () => {
    expect(ingredientIcon("Poolish Flour")).toBe("🌾");
    expect(ingredientIcon("Biga Flour")).toBe("🌾");
  });

  it("returns nothing for a label that names no ingredient", () => {
    expect(ingredientIcon("Room Temperature")).toBeUndefined();
  });
});
