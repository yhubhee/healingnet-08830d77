import { test as setup, expect } from "@playwright/test";
import { ROLES, creds, authFile } from "./env";

const HOME = { patient: /\/patient/, doctor: /\/doctor/, hospital: /\/hospital/ } as const;

for (const role of ROLES) {
  setup(`log in as ${role}`, async ({ page }) => {
    const { email, password } = creds(role);
    // The first request can wait on Vite's cold compile.
    await page.goto("/login", { timeout: 120_000 });
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL(HOME[role], { timeout: 30_000 });
    await page.context().storageState({ path: authFile(role) });
  });
}
