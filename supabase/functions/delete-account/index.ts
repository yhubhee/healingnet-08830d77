// Deletes the caller's patient account. Called by the app (Me → Delete my account) and
// by the website's /delete-account page, with the user's own JWT.
//
// 1. As the caller: delete_my_patient_data() cancels open appointments and pharmacy
//    requests and removes or strips the patient's data. It refuses doctor, hospital,
//    pharmacy and admin accounts; that message is returned with a 403.
// 2. With the service role, only after step 1 succeeded: delete the login itself.
//
// Response: { deleted: true, held_by_hospitals }. Only the outcome is logged, never the user id.
import { requireUser } from "../_shared/auth.ts";
import { serviceClient } from "../_shared/clients.ts";
import { handle, HttpError, json } from "../_shared/http.ts";

const FN = "delete-account";

Deno.serve(handle(FN, async (req) => {
  const { user, client } = await requireUser(req);

  const { data, error } = await client.rpc("delete_my_patient_data");
  if (error) {
    // The database function raises a plain-English message for accounts it won't delete.
    const refused = /closed through HealingNet support/i.test(error.message ?? "");
    console.error(`[${FN}] outcome=refused (${refused ? "not_a_patient_account" : error.code ?? "error"})`);
    if (refused) throw new HttpError(403, error.message);
    if (error.code === "42501") throw new HttpError(403, "You don't have permission to do that.");
    throw new HttpError(500, "We couldn't delete your account. Please try again.");
  }

  const held = !!(data as { held_by_hospitals?: boolean } | null)?.held_by_hospitals;

  const { error: authError } = await serviceClient().auth.admin.deleteUser(user.id);
  if (authError) {
    // The patient data is already gone; the login remains and deleting can be retried.
    console.error(`[${FN}] outcome=login_not_deleted (${authError.status ?? "error"})`);
    throw new HttpError(500, "Your data was removed, but we couldn't finish deleting your login. Please try again.");
  }

  console.log(`[${FN}] outcome=deleted held_by_hospitals=${held}`);
  return json(req, 200, { deleted: true, held_by_hospitals: held });
}));
