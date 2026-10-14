import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Filters, search and page live in the URL query string, so views are shareable and
 * survive a refresh. Setting any key other than "page" resets the page to 1.
 */
export function useUrlState() {
  const [params, setParams] = useSearchParams();
  const get = useCallback((k: string, fallback = "") => params.get(k) ?? fallback, [params]);
  const page = Math.max(1, parseInt(params.get("page") ?? "1", 10) || 1);
  const set = useCallback(
    (patch: Record<string, string | number | null | undefined>) => {
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(patch)) {
          if (v === null || v === undefined || v === "" || v === "all") next.delete(k);
          else next.set(k, String(v));
        }
        if (!("page" in patch)) next.delete("page");
        if (next.get("page") === "1") next.delete("page");
        return next;
      }, { replace: true });
    },
    [setParams],
  );
  return { get, page, set, params };
}

/** Debounce a value (search boxes wait 300 ms before querying). */
export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** A search input bound to the "q" URL key, debounced. */
export function useUrlSearch(key = "q") {
  const { get, set } = useUrlState();
  const [text, setText] = useState(get(key));
  const debounced = useDebounced(text);
  useEffect(() => {
    if (debounced !== get(key)) set({ [key]: debounced.trim() || null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);
  return { text, setText, value: get(key) };
}
