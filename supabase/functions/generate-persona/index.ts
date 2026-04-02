import { getEffectivePlan, getLimit, isWithinLimit } from "../_shared/plans.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Name bank by market + gender ──────────────────────────────────────────────
// Large pool to guarantee variety across generated personas
const NAME_BANK: Record<string, { male: string[]; female: string[]; neutral: string[] }> = {
  BR: {
    male: ["André","Bruno","Carlos","Daniel","Eduardo","Felipe","Gabriel","Henrique","Igor","João","Kaique","Leonardo","Marcos","Nathan","Otávio","Pedro","Rafael","Samuel","Thiago","Vitor","Wagner","Alexandre","Bernardo","Caio","Danilo","Erick","Fernando","Gustavo","Heitor","Ivan","Jorge","Kaua","Lucas","Matheus","Nicolas","Oswaldo","Paulo","Renato","Sérgio","Tiago","Uriel","Victor","Wesley","Xavier","Yago","Zeca","Adriano","Breno","Cristiano","Davi","Emerson","Fábio","Gilberto","Hugo","Ítalo","Júlio"],
    female: ["Ana","Beatriz","Camila","Daniela","Eduarda","Fernanda","Gabriela","Helena","Isabela","Juliana","Karine","Larissa","Mariana","Natália","Olivia","Patrícia","Rafaela","Sabrina","Tatiana","Úrsula","Valentina","Aline","Bruna","Carolina","Débora","Elisa","Flávia","Giovanna","Heloísa","Ísis","Jéssica","Karen","Letícia","Milena","Nathalia","Paloma","Renata","Simone","Tâmara","Vanessa","Amanda","Bianca","Cláudia","Diana","Emanuele","Franciele","Geovana","Hanna","Ingrid","Jaqueline"],
    neutral: ["Alex","Ariel","Dani","Rê","Sam","Chris","Quel","Val","Ri","Gui"],
  },
  MX: {
    male: ["Alejandro","Andrés","Antonio","Arturo","Carlos","César","David","Eduardo","Emilio","Ernesto","Felipe","Francisco","Gerardo","Héctor","Ignacio","Javier","Jorge","José","Juan","Luis","Manuel","Marco","Miguel","Oscar","Pablo","Rafael","Ramón","Ricardo","Roberto","Rodrigo","Santiago","Sergio","Tomás","Ulises","Vicente","Xavier","Alfredo","Benjamín","Cristóbal","Enrique","Fermín","Gilberto","Horacio","Iván","Jesús","Lorenzo","Marcos","Nicolás","Octavio","Pedro"],
    female: ["Adriana","Alejandra","Alicia","Ana","Andrea","Ángela","Beatriz","Carla","Carmen","Claudia","Daniela","Elena","Estefanía","Fernanda","Gabriela","Gloria","Guadalupe","Ingrid","Isabel","Jessica","Karla","Laura","Leticia","Liliana","Lucía","Luisa","María","Mariana","Mónica","Natalia","Paola","Patricia","Raquel","Rebeca","Rocío","Sandra","Silvia","Sofía","Valeria","Verónica","Ximena","Yolanda","Zoe","Adriana","Brenda","Cristina","Diana","Esperanza","Fabiola","Graciela"],
    neutral: ["Alex","Ariel","Sam","Chris","Val","Andy","Robin","Terry","Jordan","Casey"],
  },
  US: {
    male: ["Aaron","Adam","Alex","Andrew","Anthony","Austin","Blake","Brandon","Brian","Cameron","Chase","Chris","Connor","Daniel","David","Derek","Dylan","Ethan","Evan","Gavin","Hunter","Jack","Jacob","James","Jason","Jordan","Josh","Justin","Kevin","Kyle","Liam","Logan","Luke","Mason","Matt","Michael","Nathan","Nick","Noah","Oliver","Owen","Parker","Ryan","Sean","Seth","Taylor","Trevor","Tyler","Will","Zach"],
    female: ["Abby","Alexis","Amber","Amy","Ashley","Brittany","Brooke","Caitlin","Chelsea","Christina","Claire","Danielle","Emma","Emily","Grace","Hannah","Heather","Jessica","Julia","Kayla","Kelsey","Lauren","Lily","Madison","Megan","Michelle","Morgan","Natalie","Nicole","Olivia","Rachel","Rebecca","Riley","Samantha","Sara","Sarah","Savannah","Shannon","Stephanie","Taylor","Victoria","Whitney","Alyssa","Brianna","Chloe","Courtney","Ella","Faith","Haley","Jamie"],
    neutral: ["Alex","Avery","Blake","Cameron","Casey","Dana","Drew","Emery","Finley","Harper","Hayden","Jamie","Jordan","Kendall","Lee","Logan","Morgan","Parker","Quinn","Riley","Rowan","Ryan","Sam","Scout","Skylar","Taylor","Tegan","Terry","Tristan","Winter"],
  },
  IN: {
    male: ["Aarav","Abhishek","Aditya","Ajay","Akash","Amit","Anand","Arjun","Aryan","Deepak","Dev","Dhruv","Gaurav","Harsh","Karan","Krish","Kunal","Manish","Mohit","Neeraj","Nikhil","Pranav","Prateek","Rahul","Raj","Rajesh","Ravi","Rohit","Rohan","Sachin","Sahil","Sanjay","Saurabh","Shivam","Sunil","Suresh","Tushar","Varun","Vikas","Vikram","Vipul","Vishal","Vivek","Yash","Yogesh","Abhijit","Arun","Dheeraj","Himanshu","Kartik"],
    female: ["Aisha","Alia","Ananya","Anjali","Ankita","Ayesha","Deepika","Divya","Ishaan","Ishita","Jyoti","Kavya","Komal","Lakshmi","Meera","Megha","Monika","Namrata","Neha","Nidhi","Nisha","Pallavi","Payal","Poonam","Pooja","Priya","Priyanka","Riya","Sakshi","Sangeeta","Seema","Shikha","Shruti","Sneha","Srishti","Swati","Tanvi","Tanya","Usha","Vandana","Vidya","Yasmin","Zara","Aditi","Anamika","Bhavna","Chhavi","Diya","Ekta","Gayatri"],
    neutral: ["Aryan","Dev","Jay","Kiran","Noor","Ritu","Rohan","Sagar","Tara","Veer"],
  },
  ES: {
    male: ["Alejandro","Alfonso","Álvaro","Antonio","Arturo","Carlos","Cristian","David","Eduardo","Emilio","Enrique","Fernando","Francisco","Gonzalo","Guillermo","Ignacio","Javier","Jorge","José","Juan","Julián","Óscar","Pablo","Pedro","Rafael","Ramón","Roberto","Rodrigo","Rubén","Salvador","Santiago","Sergio","Víctor"],
    female: ["Alba","Alejandra","Alicia","Ana","Beatriz","Carmen","Claudia","Cristina","Elena","Gabriela","Isabel","Laura","Lucía","Marta","Mercedes","Natalia","Patricia","Pilar","Raquel","Sandra","Silvia","Sofía","Teresa","Valentina","Verónica","Ximena"],
    neutral: ["Álex","Ariel","Jordan","Sam","Val","Chris","Kim","Robin","Terry","Alex"],
  },
  GLOBAL: {
    male: ["Alex","Ben","Carlos","Daniel","Eric","Frank","George","Henry","Ivan","James","Kevin","Liam","Marco","Nathan","Omar","Paul","Ryan","Sam","Tom","Victor","Will","Xavier","Yusuf","Zach","Adam","Blake","Chris","Dave","Ethan"],
    female: ["Anna","Bella","Clara","Diana","Elena","Fatima","Grace","Hana","Iris","Julia","Kate","Luna","Maya","Nina","Olivia","Priya","Quinn","Rose","Sara","Tara","Uma","Vera","Wren","Xena","Yasmin","Zoe","Amy","Brooke","Claire","Dana"],
    neutral: ["Alex","Ariel","Blake","Cameron","Drew","Emery","Finley","Harper","Jordan","Lee","Morgan","Parker","Quinn","Riley","Sam","Skylar","Taylor","Terry","Tristan","Val"],
  },
};

// Fallback to GLOBAL if market not found
function pickName(market: string, gender: string): string {
  const marketKey = Object.keys(NAME_BANK).find(k => market?.toUpperCase().includes(k)) ?? "GLOBAL";
  const pool = NAME_BANK[marketKey];
  let names: string[];
  const g = gender?.toLowerCase() ?? "";
  if (g.includes("male") || g.includes("masculino") || g.includes("hombre") || g.includes("homem")) {
    names = pool.male;
  } else if (g.includes("female") || g.includes("feminino") || g.includes("mujer") || g.includes("mulher")) {
    names = pool.female;
  } else {
    // neutral / all / any
    names = [...pool.male, ...pool.female, ...pool.neutral];
  }
  return names[Math.floor(Math.random() * names.length)];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const { answers, user_id } = await req.json();
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

    // Rate limit check — use plan-based persona limit from _shared/plans.ts
    if (user_id) {
      const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

      // ── Auth: verify JWT matches user_id ───────────────────────────────────
      const authHeader = req.headers.get("Authorization") ?? "";
      if (authHeader.startsWith("Bearer ")) {
        const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser(authHeader.slice(7));
        if (authErr || !authUser || authUser.id !== user_id) {
          return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      const { data: profile } = await supabase.from("profiles").select("plan, email").eq("id", user_id).single();
      const plan = getEffectivePlan(profile?.plan, (profile as any)?.email);
      const limit = getLimit("personas", plan);
      if (limit !== -1) {
        const { count } = await supabase.from("personas").select("id", { count: "exact", head: true }).eq("user_id", user_id);
        if ((count ?? 0) >= limit) {
          return new Response(JSON.stringify({ error: "Persona limit reached for your plan.", daily_limit: true }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Pre-select a name to guarantee variety ────────────────────────────────
    const assignedName = pickName(answers.market ?? "GLOBAL", answers.gender ?? "");

    const prompt = `You are an expert performance marketing strategist. Create a highly detailed buyer persona for paid advertising.

INPUT:
- Product/offer: ${answers.product}
- Gender: ${answers.gender}
- Age range: ${answers.age}
- Income: ${answers.income}
- Market/Country: ${answers.market}
- Main platform: ${answers.platform}
- Core pain: ${answers.pain}

IMPORTANT: The persona's first name MUST be exactly "${assignedName}". Do not change it, do not use a different name.

Return ONLY a valid JSON object with these exact keys:
{
  "name": "${assignedName}",
  "age": "specific age within the ${answers.age} range",
  "gender": "${answers.gender}",
  "headline": "one-line persona description that captures their essence (e.g. The Side-Hustle Dad Who Wants His Sundays Back)",
  "bio": "2-3 sentence vivid description of their daily life, work situation, and mindset — make it feel like a real person",
  "pains": ["4 specific, emotionally resonant pain points directly related to the product/offer"],
  "desires": ["4 deep desires and aspirations — mix rational and emotional"],
  "objections": ["3 realistic objections they'd have before buying"],
  "triggers": ["4 emotional or rational purchase triggers that make them act"],
  "media_habits": ["4 specific media consumption habits — include time of day, content type, and platform behavior"],
  "best_platforms": ["2-3 best platforms to reach them, in order of priority"],
  "best_formats": ["4 best ad formats for this persona with brief reasoning"],
  "hook_angles": ["5 specific hook angles that work for this persona — include the psychological trigger each uses"],
  "language_style": "detailed description of how they speak, what slang or expressions they use, formality level, and what communication style resonates",
  "cta_style": "what CTA style works best and the psychological reason why",
  "avatar_emoji": "one emoji that perfectly represents their vibe"
}`;

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!aiRes.ok) {
      const status = aiRes.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded — try again in a moment" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted — please add credits" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${status}`);
    }

    const aiData = await aiRes.json();
    const rawText = aiData.choices?.[0]?.message?.content || "{}";
    const clean = rawText.replace(/```json|```/g, "").trim();
    const persona = JSON.parse(clean);

    // Safety net: if AI ignored the instruction, enforce the name
    if (!persona.name || persona.name.toLowerCase() === "diego" || persona.name !== assignedName) {
      persona.name = assignedName;
    }

    // Fire business-profiler async — research this business before anyone talks about it
    // Don't await — return to user immediately, let it run in background
    if (user_id && answers?.product) {
      const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
      sb.functions.invoke("business-profiler", {
        body: {
          user_id,
          product_name: answers.product,
          website: answers.website || "",
          market: answers.market || "BR",
          niche: answers.niche || answers.pain || "",
        }
      }).catch(() => {}); // Non-fatal — never block persona creation
    }

    return new Response(JSON.stringify({ success: true, persona }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-persona error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
