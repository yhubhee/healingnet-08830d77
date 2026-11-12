// Messages arrive in a later version; for now this hands off to the website.
import { MessageCircle } from "lucide-react-native";
import { Screen } from "@/components/Screen";
import { EmptyState } from "@/components/ui";
import { openWeb } from "@/lib/web";

export default function Messages() {
  return (
    <Screen tab title="Messages">
      <EmptyState icon={MessageCircle} title="Coming soon" text="Use the website for now." actionLabel="Open messages on the website" onAction={() => openWeb("/patient/messages")} />
    </Screen>
  );
}
