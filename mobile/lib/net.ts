import { onlineManager } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

/** True while the phone has a connection. Actions that need the network are disabled when false. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => onlineManager.isOnline(),
    () => true,
  );
}

export const OFFLINE_ACTION = "You're offline. Connect to the internet to do this.";
