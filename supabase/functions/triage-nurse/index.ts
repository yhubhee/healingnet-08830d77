import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SYSTEM = `You are an AI triage nurse modelled after Infermedica's diagnostic engine.
You are NOT diagnosing — you collect evidence and output a probabilistic differential plus a triage level.
Always be cautious, surface red flags, never prescribe medication, and respond ONLY by calling the supplied tool.
Adapt to the patient's age and biological sex. Stop after at most 8 questions or when one condition's probability dominates (>0.6) or when a red flag is detected.
Never repeat a question already answered. Ask the single most informative yes/no question next.`;

const URGENCY_LEVELS = ["self_care", "consultation", "consultation_24", "emergency_ambulance", "emergency"];

const TOOL_DEF = {
  type: "function",
  function: {
    name: "triage_response",
    description: "Return the next triage step.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        new_evidence: {
          type: "array",
          description: "Symptoms/findings extracted from the patient's free-text input (parse stage only).",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              id: { type: "string", description: "snake_case symptom id" },
              name: { type: "string" },
              present: { type: "boolean" },
            },
            required: ["id", "name", "present"],
          },
        },
        next_question: {
          type: "object",
          additionalProperties: false,
          description: "The next yes/no question to ask. Omit when should_stop is true.",
          properties: {
            id: { type: "string" },
            text: { type: "string" },
            explanation: { type: "string", description: "Short why-we-ask hint." },
          },
          required: ["id", "text"],
        },
        should_stop: { type: "boolean", description: "True when interview should end and final results shown." },
        differential: {
          type: "array",
          description: "Top conditions with probabilities (0-1). Always include.",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              name: { type: "string" },
              probability: { type: "number" },
              description: { type: "string" },
            },
            required: ["name", "probability"],
          },
        },
        triage_level: { type: "string", enum: URGENCY_LEVELS },
        triage_label: { type: "string", description: "Short human label e.g. 'See a GP within 24h'." },
        recommended_specialty: { type: "string" },
        red_flags: { type: "array", items: { type: "string" } },
        guidance: { type: "string", description: "Plain-language advice for the patient." },
      },
      required: ["should_stop", "differential", "triage_level", "triage_label", "recommended_specialty", "guidance"],
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { stage, age, sex, free_text, evidence, asked_ids } = await req.json();
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

    let userMsg = "";
    if (stage === "parse") {
      userMsg = `Patient: age ${age}, sex ${sex}.
Initial complaint (free text): """${free_text}"""

Task: Extract clinical evidence from the text into new_evidence (snake_case ids). Then ask the FIRST diagnostic yes/no question via next_question. Set should_stop=false. Provide a tentative differential.`;
    } else if (stage === "next") {
      userMsg = `Patient: age ${age}, sex ${sex}.
Evidence collected so far:
${JSON.stringify(evidence, null, 2)}

Already-asked question ids: ${JSON.stringify(asked_ids || [])}

Task: If you have enough information (a dominant condition, red flag, or 8+ questions asked) set should_stop=true and provide the final differential, triage_level, recommended_specialty, red_flags and guidance. Otherwise return the next single most informative yes/no question in next_question (with a NEW id) and an updated tentative differential.`;
    } else {
      throw new Error("Invalid stage");
    }

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userMsg },
        ],
        tools: [TOOL_DEF],
        tool_choice: { type: "function", function: { name: "triage_response" } },
      }),
    });

    if (resp.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded, please wait a moment." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (resp.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in workspace settings." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI gateway error:", resp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) throw new Error("No tool call returned");
    const result = JSON.parse(call.function.arguments);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("triage-nurse error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
