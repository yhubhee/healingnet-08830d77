// Theme: follows the phone's setting, with an override (System, Light or Dark) saved on the device.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import { palettes, resolveScheme, type Colors, type Scheme, type ThemeChoice } from "./tokens";

export * from "./tokens";

const KEY = "hn.theme";

interface ThemeValue {
  colors: Colors;
  scheme: Scheme;
  choice: ThemeChoice;
  setChoice: (c: ThemeChoice) => void;
}

const ThemeContext = createContext<ThemeValue>({ colors: palettes.light, scheme: "light", choice: "system", setChoice: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [choice, setChoiceState] = useState<ThemeChoice>("system");

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => {
      if (v === "light" || v === "dark" || v === "system") setChoiceState(v);
    }).catch(() => {});
  }, []);

  const setChoice = useCallback((c: ThemeChoice) => {
    setChoiceState(c);
    AsyncStorage.setItem(KEY, c).catch(() => {});
  }, []);

  const value = useMemo<ThemeValue>(() => {
    const scheme = resolveScheme(choice, system);
    return { colors: palettes[scheme], scheme, choice, setChoice };
  }, [choice, system, setChoice]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
