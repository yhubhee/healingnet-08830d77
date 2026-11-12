import { dark, light, MIN_TOUCH, QR_BACKGROUND, resolveScheme } from "../theme/tokens";

describe("theme tokens", () => {
  it("light and dark have the same keys", () => {
    expect(Object.keys(dark).sort()).toEqual(Object.keys(light).sort());
  });

  it("every token is a colour value", () => {
    for (const palette of [light, dark]) {
      for (const [key, value] of Object.entries(palette)) {
        expect([key, /^(#[0-9A-Fa-f]{6}|rgba\(.+\))$/.test(value)]).toEqual([key, true]);
      }
    }
  });

  it("matches the approved mockup for the main colours", () => {
    expect(light.background).toBe("#FBFAF7");
    expect(dark.background).toBe("#0F1C1F");
    expect(light.primary).toBe("#186E6A");
    expect(dark.primary).toBe("#1E7F79");
    expect(dark.primaryText).toBe("#7ED3CD");
    expect(light.hero).toBe("#186E6A");
    expect(dark.hero).toBe("#14504D");
    expect(light.danger).toBe("#B91E1E");
    expect(dark.tabBar).toBe("#132428");
  });

  it("keeps the QR on white and touch targets at 48 or more", () => {
    expect(QR_BACKGROUND).toBe("#FFFFFF");
    expect(MIN_TOUCH).toBeGreaterThanOrEqual(48);
  });

  it("follows the phone unless the person chose Light or Dark", () => {
    expect(resolveScheme("system", "dark")).toBe("dark");
    expect(resolveScheme("system", "light")).toBe("light");
    expect(resolveScheme("system", null)).toBe("light");
    expect(resolveScheme("light", "dark")).toBe("light");
    expect(resolveScheme("dark", "light")).toBe("dark");
  });
});
