import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getMyProfile from "./tools/get-my-profile";
import listMyAppointments from "./tools/list-my-appointments";
import listMyPrescriptions from "./tools/list-my-prescriptions";
import listMyLabResults from "./tools/list-my-lab-results";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "healingnet-mcp",
  title: "HealingNet",
  version: "0.1.0",
  instructions:
    "Tools for HealingNet — a Nigerian healthcare platform. Read the signed-in user's profile, appointments, prescriptions, and lab orders. All tools respect Row-Level Security and operate as the authenticated user.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getMyProfile, listMyAppointments, listMyPrescriptions, listMyLabResults],
});
