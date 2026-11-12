// Copies the website's generated Supabase types into the app, so both use one schema.
// Run from mobile/: npm run sync-types
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const from = resolve(here, "../../src/integrations/supabase/types.ts");
const to = resolve(here, "../shared/database.types.ts");

copyFileSync(from, to);
const banner = "// Copied from src/integrations/supabase/types.ts by `npm run sync-types`. Do not edit here.\n";
writeFileSync(to, banner + readFileSync(to, "utf8"));
console.log("Synced database types to shared/database.types.ts");
