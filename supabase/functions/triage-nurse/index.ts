import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SYSTEM = `You are an advanced AI triage nurse following evidence-based diagnostic protocols.
Your role is to collect comprehensive clinical evidence and provide informed triage recommendations.

CRITICAL GUIDELINES:
1. SEVERITY ASSESSMENT FIRST: Always assess symptom severity on a 1-10 scale early in the interview
2. SPECIALTY ROUTING - MUST FOLLOW:
   - Chest pain/breathing issues → Cardiology or Pulmonology
   - Severe headache/neurological symptoms → Neurology
   - Abdominal pain → Gastroenterology
   - Skin rash/dermatological → Dermatology
   - Pregnancy-related → Obstetrics
   - Musculoskeletal pain → Orthopedics
   - Throat/ear issues → ENT
   - Mental health crisis → Psychiatry
   - Fever/general infection → General Practice
   - Other/unclear → General Practice
   DEFAULT: General Practice (NOT "self-care")
3. PREVENT "SELF-CARE" DEFAULTS: NEVER recommend triage_level="self_care" if:
   - Severity >= 5
   - Any red flags detected (fever + chills, chest pain, severe headache, difficulty breathing, etc.)
   - Symptoms have lasted >1 week without improvement
   - Patient reports significant impact on daily functioning
4. ASK ABOUT TIMELINE: Always determine symptom onset and duration (hours/days/weeks/months)
5. ASK ABOUT IMPACT: Determine if symptoms affect work, sleep, daily activities
6. ASK STRATEGICALLY: Vary question types based on what helps diagnosis:
   - Yes/No for binary symptoms (fever? rash?)
   - Multiple-choice for categories (When did it start? Type of cough?)
   - Scale for subjective measures (Pain level 1-10?)
   - Duration for timeline (How long?)
7. SURFACE RED FLAGS: Always identify and emphasize warning signs
8. DIFFERENTIAL REASONING: Provide 3-5 top conditions with probabilities
9. CONTEXTUAL MATCHING: Match specialty recommendation to primary diagnosis condition

Never repeat already-answered questions. Adapt to age/sex. Stop after 8 questions OR diagnosis clear OR red flag detected.`;

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
          description: "The next diagnostic question (can be yes/no, multiple-choice, scale, or duration).",
          properties: {
            id: { type: "string" },
            text: { type: "string" },
            explanation: { type: "string", description: "Short why-we-ask hint." },
            type: {
              type: "string",
              enum: ["boolean", "multiple_choice", "scale", "duration"],
              description: "Question type. boolean=yes/no, multiple_choice=radio buttons, scale=1-10 slider, duration=number+unit"
            },
            options: {
              type: "array",
              items: { type: "string" },
              description: "For multiple_choice type: list of options. For scale: [min_label, max_label]"
            },
            unit: {
              type: "string",
              description: "For scale questions: e.g., '1-10 pain', '1-10 severity'. For duration: 'hours', 'days', 'weeks'"
            },
          },
          required: ["id", "text", "type"],
        },
        should_stop: { type: "boolean", description: "True when interview should end and final results shown." },
        differential: {
          type: "array",
          description: "Top conditions with probabilities (0-1). Always include 3-5 conditions.",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              name: { type: "string" },
              probability: { type: "number" },
              description: { type: "string", description: "Brief description of this condition" },
            },
            required: ["name", "probability"],
          },
        },
        severity_score: {
          type: "number",
          description: "Calculated severity on 1-10 scale based on symptoms. Must be provided when should_stop=true"
        },
        triage_level: { type: "string", enum: URGENCY_LEVELS },
        triage_label: { type: "string", description: "Short human label e.g. 'See a GP within 24h'." },
        recommended_specialty: { type: "string" },
        red_flags: { type: "array", items: { type: "string" }, description: "Any warning signs detected" },
        guidance: { type: "string", description: "Plain-language advice for the patient. Be specific about what to do next." },
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

Task:
1. Extract clinical evidence from the text into new_evidence (snake_case ids)
2. Ask the FIRST diagnostic question - prioritize asking about severity (1-10 scale) or duration
3. Vary question types based on what's most useful (not just yes/no)
4. Set should_stop=false
5. Provide a tentative differential with 3-5 conditions

Remember: First question should help assess HOW SERIOUS this is (severity) or HOW LONG (duration).`;
    } else if (stage === "next") {
      userMsg = `Patient: age ${age}, sex ${sex}.
Evidence collected so far:
${JSON.stringify(evidence, null, 2)}

Already-asked question ids: ${JSON.stringify(asked_ids || [])}

Task:
1. Analyze collected evidence for severity, duration, impact, and red flags
2. If you have enough information (clear diagnosis, red flag detected, or 8+ questions asked):
   - Set should_stop=true
   - Provide final differential (3-5 conditions with probabilities)
   - Calculate severity_score (1-10) based on symptoms
   - Set appropriate triage_level (Only use "consultation" or "consultation_24" or "emergency" — NEVER "self-care" if severity >= 5 or red flags present)
   - Recommend specialty based on primary diagnosis condition (Refer to the specialty list in system prompt)
   - List any red flags
   - Provide specific actionable guidance
3. Otherwise:
   - Ask the next most informative question
   - Vary question type: use multiple_choice for categories, scale for severity/pain, duration for timeline, boolean only for simple yes/no
   - Avoid repeating already-asked questions

CRITICAL:
- If severity seems significant (4+) and you haven't asked about duration/timeline yet, ask about that first.
- Always set recommended_specialty to an actual medical specialty, NEVER "self-care"
- Map condition diagnosis to a specialty (e.g., "Migraines" → "Neurology", "Gastritis" → "Gastroenterology")`;
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
