import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

interface EmailPayload {
  hospitalId: string;
  doctorName: string;
  action: "added" | "removed" | "updated";
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

    // Send email via Supabase Auth email service
    // Note: This uses Supabase's built-in email service. For production, consider using Resend, SendGrid, etc.
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

    // Notify doctor if email provided and action is add/update
    if (doctorEmail && (action === "added" || action === "updated")) {
      const doctorSubject =
        action === "added"
          ? `Welcome to ${hospital?.name || "HealingNet"}!`
          : `Your Information Updated at ${hospital?.name || "HealingNet"}`;

      const doctorMessage =
        action === "added"
          ? `You have been assigned to ${hospital?.name || "our hospital"}. Log in to HealingNet to view your assignment details.`
          : `Your information at ${hospital?.name || "our hospital"} has been updated. Please log in to verify the changes.`;

      const { error: doctorEmailError } = await supabase.auth.admin.sendRawEmail(
        {
          email: doctorEmail,
          subject: doctorSubject,
          html: `
            <div style="font-family: Arial, sans-serif; color: #333;">
              <h2 style="color: #4CAF50;">${doctorSubject}</h2>
              <p>${doctorMessage}</p>
              <p style="color: #666; font-size: 12px;">
                Sent from HealingNet Doctor Management System
              </p>
            </div>
          `,
        }
      );

      if (doctorEmailError) {
        console.error("Doctor email error:", doctorEmailError);
      }
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
