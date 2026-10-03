import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LAB_CATALOG } from "@/lib/lab/catalog";
import { APPENDIX_LAB_TESTS } from "@/lib/lab/appendixCatalog";

export type PickerItem = {
  key: string;
  kind: "lab" | "imaging" | "other";
  section: string;
  name: string;
  aliases: string[];
  fasting: boolean;
  views: string[];
  laterality: boolean;
  /** Lab: id from the in-app catalog (auto-populated result entry). */
  labCatalogId?: string;
  /** Imaging/other: diagnostic_catalog row id. */
  catalogId?: string;
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const abbr = (s: string) => (s.match(/\(([^)]+)\)/)?.[1] || "");

const FASTING_IDS = new Set(["lipid", "fbg"]);

/** Merge the in-app lab catalog with the appendix list, skipping duplicates. */
function buildLabItems(): PickerItem[] {
  const items: PickerItem[] = LAB_CATALOG.map((t) => ({
    key: `lab:${t.id}`, kind: "lab", section: t.category, name: t.name,
    aliases: [abbr(t.name)].filter(Boolean), fasting: FASTING_IDS.has(t.id), views: [], laterality: false, labCatalogId: t.id,
  }));
  const seen = new Map<string, PickerItem>();
  items.forEach((i) => { seen.set(norm(i.name), i); i.aliases.forEach((a) => seen.set(norm(a), i)); seen.set(norm(i.name.replace(/\s*\([^)]*\)/, "")), i); });
  for (const t of APPENDIX_LAB_TESTS) {
    const keys = [t.name, t.name.replace(/\s*\([^)]*\)/, ""), ...t.aliases].map(norm).filter(Boolean);
    const dup = keys.map((k) => seen.get(k)).find(Boolean);
    if (dup) { dup.aliases = Array.from(new Set([...dup.aliases, ...t.aliases])); if (t.fasting) dup.fasting = true; continue; }
    const it: PickerItem = { key: `lab:a:${norm(t.name)}`, kind: "lab", section: t.category, name: t.name, aliases: t.aliases, fasting: t.fasting, views: [], laterality: false };
    items.push(it);
    keys.forEach((k) => seen.set(k, it));
  }
  return items;
}

export function useInvestigationCatalog() {
  return useQuery({
    queryKey: ["investigation-catalog"],
    staleTime: Infinity,
    gcTime: Infinity,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("diagnostic_catalog").select("id,kind,section,name,aliases,allowed_views,has_laterality,sort_order")
        .eq("is_active", true).order("sort_order");
      if (error) throw error;
      const dx: PickerItem[] = (data || []).map((r: any) => ({
        key: `dx:${r.id}`, kind: r.kind, section: r.section, name: r.name, aliases: r.aliases || [],
        fasting: false, views: r.allowed_views || [], laterality: !!r.has_laterality, catalogId: r.id,
      }));
      return [...buildLabItems(), ...dx];
    },
  });
}

/** Simple fuzzy match: every query word must be a substring of name or an alias. */
export function matchItem(item: PickerItem, q: string) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = [item.name, ...item.aliases, item.section].join(" ").toLowerCase();
  const compact = norm(hay);
  return words.every((w) => hay.includes(w) || compact.includes(norm(w)));
}
