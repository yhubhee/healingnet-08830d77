import { useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

/**
 * The open hospital / doctor detail lives in the URL (?hospital=<id> or ?doctor=<id>),
 * so it survives refresh, can be shared, and can be opened from anywhere (search, audit log).
 */
export function useDetail() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const hospitalId = params.get("hospital");
  const doctorId = params.get("doctor");

  const open = useCallback(
    (kind: "hospital" | "doctor", id: string, path?: string) => {
      if (path) {
        navigate(`${path}?${kind}=${encodeURIComponent(id)}`);
        return;
      }
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete("hospital");
        next.delete("doctor");
        next.set(kind, id);
        return next;
      });
    },
    [navigate, setParams],
  );

  const close = useCallback(() => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("hospital");
      next.delete("doctor");
      return next;
    });
  }, [setParams]);

  return { hospitalId, doctorId, open, close };
}
