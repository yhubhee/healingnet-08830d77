// Me → Delete my account. Explains what happens, asks the person to type DELETE, calls
// the delete-account function, clears this phone and returns to the welcome screen.
import { useState } from "react";
import { Field } from "@/components/form";
import { Screen } from "@/components/Screen";
import { useToast } from "@/components/toast";
import { Body, Button, Card, Notice, Strong } from "@/components/ui";
import { deleteMyAccount } from "@/lib/deleteAccount";
import { OFFLINE_ACTION, useOnline } from "@/lib/net";
import { useSession } from "@/lib/session";
import { space } from "@/theme";

export const DELETE_EXPLANATION =
  "Your login, contact details, devices and notifications are deleted. Appointments that are still open are cancelled. If you have been a patient at a hospital on HealingNet, that hospital keeps its medical records about you, as the law requires; they are no longer linked to an account.";

export default function DeleteAccount() {
  const toast = useToast();
  const online = useOnline();
  const { signOut } = useSession();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const confirmed = typed.trim() === "DELETE";

  async function remove() {
    if (!confirmed) return;
    setBusy(true);
    try {
      const result = await deleteMyAccount();
      // Clears the saved data, the push registration and the session; the app returns to Welcome.
      await signOut();
      toast.success(result.held_by_hospitals
        ? "Your account is deleted. Hospitals you visited keep their own medical records."
        : "Your account and data are deleted.");
    } catch (e) {
      setBusy(false);
      toast.error(e instanceof Error ? e.message : "We couldn't delete your account. Please try again.");
    }
  }

  return (
    <Screen title="Delete my account" back
      footer={
        <>
          {!online ? <Notice tone="warning" text={OFFLINE_ACTION} /> : null}
          <Button label="Delete my account" variant="danger" onPress={remove} loading={busy}
            disabled={!confirmed || !online} disabledReason={!online ? OFFLINE_ACTION : "Type DELETE to confirm first"} />
        </>
      }>
      <Card style={{ gap: space.md }}>
        <Strong>What happens</Strong>
        <Body>{DELETE_EXPLANATION}</Body>
      </Card>
      <Notice tone="danger" text="This can't be undone." />
      <Field label="Type DELETE to confirm" value={typed} onChangeText={setTyped} autoCapitalize="characters" autoCorrect={false} />
    </Screen>
  );
}
