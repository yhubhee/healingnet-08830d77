// The active person on this phone ("Me" or a family member). The choice is saved with the
// other small device settings (an id only, nothing personal) and removed at sign-out.
import { useSyncExternalStore } from "react";
import { createActivePersonStore } from "@/shared/activePerson";
import { DEVICE_KEYS, setFlag } from "./storage";

export const activePerson = createActivePersonStore((id) => { setFlag(DEVICE_KEYS.activePerson, id); });

/** The active family member's patient id, or null for "Me". */
export const useActivePersonId = () => useSyncExternalStore(activePerson.subscribe, activePerson.get, activePerson.get);
