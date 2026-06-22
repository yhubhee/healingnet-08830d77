import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

interface EmailPayload {
  hospitalId: string;
  doctorName: string;
  action: "added" | "removed" | "updated" | "invited";
  details?: string;
  adminEmail: string;
  doctorEmail?: string;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const payload: EmailPayload = await req.json();
    const { hospitalId, doctorName, action, details, adminEmail, doctorEmail } =
      payload;

    // Get hospital info for context
    const { data: hospital } = await supabase
      .from("hospitals")
      .select("name")
      .eq("id", hospitalId)
      .single();

    if (action === "invited") {
      // Send invitation to doctor
      const invitationLink = `${Deno.env.get("PUBLIC_URL")}/doctor/invitations`;
      const { error } = await supabase.auth.admin.sendRawEmail({
        email: doctorEmail!,
        subject: `Invitation: Join ${hospital?.name || "HealingNet"}`,
        html: `
          <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px;">
            <h2 style="color: #4CAF50;">You've Been Invited!</h2>
            <p>Hello Dr. ${doctorName},</p>
            <p>
              ${hospital?.name || "A hospital"} has invited you to join their medical team.
              <strong>This invitation requires your acceptance.</strong>
            </p>
            <p style="margin: 30px 0;">
              <a href="${invitationLink}" style="
                display: inline-block;
                background-color: #4CAF50;
                color: white;
                padding: 12px 30px;
                text-decoration: none;
                border-radius: 4px;
                font-weight: bold;
              ">
                View & Respond to Invitation
              </a>
            </p>
            <p style="color: #666; font-size: 12px;">
              Sent from HealingNet Doctor Management System
            </p>
          </div>
        `,
      });

      if (error) console.error("Invitation email error:", error);
      return new Response(
        JSON.stringify({ success: true, message: "Invitation sent" }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Notify hospital admin
    const adminSubject =
      action === "added"
        ? `Doctor Added: Dr. ${doctorName}`
        : action === "removed"
          ? `Doctor Removed: Dr. ${doctorName}`
          : `Doctor Updated: Dr. ${doctorName}`;

    const adminMessage =
      action === "added"
        ? `Dr. ${doctorName} has been added to ${hospital?.name || "your hospital"}.${details ? " " + details : ""}`
        : action === "removed"
          ? `Dr. ${doctorName} has been removed from ${hospital?.name || "your hospital"}.`
          : `Dr. ${doctorName}'s information has been updated at ${hospital?.name || "your hospital"}.\n\nChanges: ${details}`;

    const { error: adminEmailError } = await supabase.auth.admin.sendRawEmail({
      email: adminEmail,
      subject: adminSubject,
      html: `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <h2 style="color: #4CAF50;">${adminSubject}</h2>
          <p>${adminMessage}</p>
          <p style="color: #666; font-size: 12px;">
            Sent from HealingNet Doctor Management System
          </p>
        </div>
      `,
    });

    if (adminEmailError) {
      console.error("Admin email error:", adminEmailError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Notifications sent",
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error sending notifications:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
