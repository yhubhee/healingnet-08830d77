import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

// Below Tailwind's `sm` (640 px) toasts go to the top, like the Radix toaster, so they
// never cover fixed bottom bars such as the consultation's Submit bar.
const SMALL = "(max-width: 639px)";
const subscribe = (onChange: () => void) => {
  const mq = window.matchMedia(SMALL);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
};
const isSmall = () => window.matchMedia(SMALL).matches;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();
  const small = useSyncExternalStore(subscribe, isSmall, () => false);

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position={small ? "top-center" : "bottom-right"}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
