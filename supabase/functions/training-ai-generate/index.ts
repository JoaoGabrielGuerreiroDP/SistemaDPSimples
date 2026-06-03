import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function fetchYouTubeTranscript(videoId: string): Promise<string | null> {
  try {
    // Method 1: Try innertube API to get caption tracks
    const innertubeRes = await fetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        context: {
          client: {
            hl: "pt",
            gl: "BR",
            clientName: "WEB",
            clientVersion: "2.20240101.00.00",
          },
        },
        videoId,
      }),
    });

    const playerData = await innertubeRes.json();
    const captionTracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

    if (!captionTracks || captionTracks.length === 0) {
      console.log("No caption tracks from innertube API");

      // Method 2: Fallback - try HTML page
      const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const res = await fetch(watchUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Cookie": "CONSENT=YES+1",
          "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
        },
      });
      const html = await res.text();
      const tracksMatch = html.match(/"captionTracks"\s*:\s*(\[.*?\])/s);
      if (!tracksMatch) {
        console.log("No captionTracks in HTML fallback either");
        return null;
      }
      try {
        const tracks = JSON.parse(tracksMatch[1].replace(/\\u0026/g, "&"));
        if (!tracks || tracks.length === 0) return null;
        const track = tracks.find((t: any) => t.languageCode === "pt") || tracks[0];
        return await fetchCaptionText(track.baseUrl.replace(/\\u0026/g, "&"));
      } catch {
        console.log("Failed to parse HTML caption tracks");
        return null;
      }
    }

    // Use innertube tracks
    const track = captionTracks.find((t: any) => t.languageCode === "pt") || captionTracks[0];
    console.log(`Found caption track: ${track.languageCode} (${track.kind || "manual"})`);
    return await fetchCaptionText(track.baseUrl);
  } catch (e) {
    console.error("Error fetching transcript:", e);
    return null;
  }
}

async function fetchCaptionText(captionUrl: string): Promise<string | null> {
  try {
    const captionRes = await fetch(captionUrl);
    const captionXml = await captionRes.text();

    const textParts: string[] = [];
    const textRegex = /<text[^>]*>(.*?)<\/text>/gs;
    let m;
    while ((m = textRegex.exec(captionXml)) !== null) {
      let text = m[1]
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/<[^>]+>/g, "")
        .trim();
      if (text) textParts.push(text);
    }

    if (textParts.length === 0) return null;

    const transcript = textParts.join(" ");
    console.log(`Transcript fetched: ${transcript.length} chars, ${textParts.length} segments`);
    return transcript.length > 12000 ? transcript.substring(0, 12000) + "..." : transcript;
  } catch (e) {
    console.error("Error fetching caption text:", e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const _authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: _userData, error: _userErr } = await _authClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (_userErr || !_userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const _svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: _isAdmin } = await _svc.rpc("has_role", { _user_id: _userData.user.id, _role: "admin" });
    const { data: _isGestor } = await _svc.rpc("has_role", { _user_id: _userData.user.id, _role: "gestor" });
    if (!_isAdmin && !_isGestor) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { video_id, youtube_url, title, description, manual_transcript } = await req.json();
    if (!video_id || !youtube_url || !title) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract video ID
    const match = youtube_url.match(
      /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?\s]{11})/
    );
    const ytId = match ? match[1] : null;
    if (!ytId) {
      return new Response(JSON.stringify({ error: "Invalid YouTube URL" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use manual transcript if provided, otherwise try to fetch automatically
    let transcript: string | null = null;
    if (manual_transcript && typeof manual_transcript === "string" && manual_transcript.trim().length >= 50) {
      transcript = manual_transcript.trim().length > 12000
        ? manual_transcript.trim().substring(0, 12000) + "..."
        : manual_transcript.trim();
      console.log(`Using manual transcript: ${transcript.length} chars`);
    } else {
      transcript = await fetchYouTubeTranscript(ytId);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const hasTranscript = !!transcript;
    
    const prompt = hasTranscript
      ? `Você é um especialista em treinamento corporativo. Abaixo está a TRANSCRIÇÃO COMPLETA de um vídeo de treinamento. Com base nela, crie:

1. Um **resumo** detalhado e fiel ao conteúdo do vídeo (3-5 parágrafos)
2. Uma **prova** com exatamente 5 questões de múltipla escolha (4 alternativas cada), baseadas no conteúdo real do vídeo

Título: "${title}"
URL: ${youtube_url}

TRANSCRIÇÃO DO VÍDEO:
${transcript}

IMPORTANTE: As questões devem ser baseadas no conteúdo real da transcrição, não em suposições. Responda usando a função/tool fornecida.`
      : `Você é um especialista em treinamento corporativo. Com base nas informações do vídeo de treinamento abaixo, crie:

1. Um **resumo** detalhado do que é abordado no vídeo (3-5 parágrafos). Seja específico e relevante ao tema.
2. Uma **prova** com exatamente 5 questões de múltipla escolha (4 alternativas cada), cobrindo os pontos principais do treinamento

Título do vídeo: "${title}"
${description ? `Descrição do vídeo: "${description}"` : ''}
URL: ${youtube_url}

IMPORTANTE: Use o título${description ? ' e a descrição' : ''} para inferir o conteúdo do treinamento e gerar material educativo relevante e específico. Responda usando a função/tool fornecida.`;

    console.log(`Generating content for "${title}" - transcript available: ${hasTranscript}`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: "Você é um especialista em criar materiais de treinamento corporativo em português brasileiro. Gere conteúdo educacional de alta qualidade baseado fielmente no material fornecido.",
          },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_training_content",
              description: "Gera resumo e prova para um vídeo de treinamento",
              parameters: {
                type: "object",
                properties: {
                  summary: {
                    type: "string",
                    description: "Resumo detalhado do conteúdo do vídeo (3-5 parágrafos em português)",
                  },
                  quiz: {
                    type: "array",
                    description: "Array com 5 questões de múltipla escolha",
                    items: {
                      type: "object",
                      properties: {
                        question: { type: "string", description: "Pergunta da questão" },
                        options: {
                          type: "array",
                          items: { type: "string" },
                          description: "4 alternativas (A, B, C, D)",
                        },
                        correct: {
                          type: "number",
                          description: "Índice da resposta correta (0-3)",
                        },
                        explanation: {
                          type: "string",
                          description: "Breve explicação da resposta correta",
                        },
                      },
                      required: ["question", "options", "correct", "explanation"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["summary", "quiz"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_training_content" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in AI response");

    const content = JSON.parse(toolCall.function.arguments);

    // Save to database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error: dbError } = await supabase
      .from("training_videos")
      .update({
        ai_summary: content.summary,
        ai_quiz: content.quiz,
        ai_generated_at: new Date().toISOString(),
      })
      .eq("id", video_id);

    if (dbError) {
      console.error("DB error:", dbError);
      throw new Error("Failed to save to database");
    }

    return new Response(JSON.stringify({ summary: content.summary, quiz: content.quiz, has_transcript: hasTranscript }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("training-ai-generate error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
