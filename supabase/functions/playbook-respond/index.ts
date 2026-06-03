import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Catálogo de objeções extraídas do Playbook DP (sem IA — match local).
// Cada entrada tem palavras-chave + as 3 abordagens já escritas no tom do playbook.
type ObjEntry = {
  category: string;
  keywords: string[];
  quick_phrase: string;
  logical_approach: string;
  emotional_approach: string;
  technical_approach: string;
  video_hint: string; // termo pra casar com title/description de training_videos
};

const OBJECTIONS: ObjEntry[] = [
  {
    category: "Demora pra ser contemplado",
    keywords: ["demora", "demorar", "demorado", "muito tempo", "lento", "anos", "longo", "esperar", "espera"],
    quick_phrase: "Quando você fala que vai demorar muito… quanto tempo exatamente você considera muito?",
    logical_approach:
      "Explore o tempo: \"Quando você fala que vai demorar muito… quanto tempo exatamente você considera muito?\"\n\nVerdade inevitável: \"O tempo vai passar de qualquer forma… você concorda?\"\n\nFechamento: \"Então, pra você não perder mais tempo, porque ele vai passar de qualquer forma, eu só preciso pegar alguns dados seus pra gente iniciar.\"",
    emotional_approach:
      "Quebra de perspectiva: \"10 anos pode ser muito tempo pra algumas coisas… mas pra construir um patrimônio, um legado, pode ser pouco. Tudo depende da forma como você enxerga.\"\n\nProjeção futura: \"Como você quer estar daqui a X anos? Uma pessoa que construiu algo, guardou dinheiro, evoluiu… ou alguém com os mesmos problemas de hoje?\"\n\nConexão com a solução: \"Se você sair dessa nossa conversa sem dar um passo em direção ao seu objetivo, você concorda que ficará ainda mais longe do seu sonho?\"",
    technical_approach:
      "Mostre as modalidades de lance do Novo Consórcio:\n\n• Lance livre (≈70%): contemplação típica em 6 meses a 1 ano.\n• Lance fixo (45% = 25% crédito + 20% bolso): médio prazo, menos concorrência.\n• Lance embutido (até 25% do crédito): sem tirar do bolso, médio a longo prazo.\n\nReforce: até a contemplação a parcela é REDUZIDA — ele não paga cheio enquanto não usa o crédito.",
    video_hint: "demora",
  },
  {
    category: "Preciso falar com cônjuge / sócio",
    keywords: ["esposa", "esposo", "marido", "mulher", "cônjuge", "conjuge", "namorad", "sócio", "socio", "parceir", "família", "familia", "consultar", "alguém", "alguem"],
    quick_phrase: "A opinião dele(a) é importante quando o assunto é decisão financeira ligada a patrimônio, certo? Então faz ainda mais sentido participar dessa conversa.",
    logical_approach:
      "Pergunta de qualificação: \"Você acredita que a opinião do(a) seu/sua [cônjuge/sócio] é importante pra você quando o assunto é decisão financeira… principalmente algo ligado a patrimônio?\"\n\nDupla confirmação (se insistir em decidir sozinho): \"Independente das condições, do valor da carta e das estratégias que eu te mostrar… a opinião dele(a) realmente não influencia na sua decisão?\" — se travar, já revelou que NÃO decide sozinho.",
    emotional_approach:
      "Enquadramento: \"Faz ainda mais sentido ele(a) participar. Podem surgir dúvidas que talvez você nem esteja enxergando agora — sobre planejamento, prazos e estratégia de contemplação. Tomar uma decisão dessas com alinhamento entre vocês dois é completamente diferente de decidir sozinho, concorda?\"\n\nReenquadramento (se 'ele(a) não tem tempo'): \"Se isso é importante pra você, por que não seria importante pra ele(a) também? Ao ponto de reservar 20-30 minutos pra entender algo que impacta diretamente o futuro de vocês?\"",
    technical_approach:
      "Argumento técnico: \"Se ele(a) não participa, a tendência é olhar isso só como parcela ou custo… e não como estratégia de construção de patrimônio, aquisição planejada ou alavancagem financeira. Aí você corre o risco de tomar uma decisão baseada em preço — não no que isso pode gerar no longo prazo.\"\n\nDirecionamento: \"Vamos remarcar com vocês dois, pra tomarem a melhor decisão juntos. Antes de você falar qualquer coisa sobre consórcio com ela, me permite explicar pra ela tudo o que apresentei pra você?\"",
    video_hint: "esposa",
  },
  {
    category: "Vou pensar",
    keywords: ["pensar", "pensando", "vou ver", "depois", "analisar", "refletir", "decidir depois", "te aviso", "retorno"],
    quick_phrase: "Além de pensar, tem mais alguma coisa que está te impedindo de começar hoje?",
    logical_approach:
      "Isolamento: \"Além de pensar, tem mais alguma coisa que está te impedindo de começar hoje?\"\n\nClareza: \"Quando você fala que vai pensar… exatamente sobre o que você vai pensar?\"\n\nFechamento: \"Então me fala… o que exatamente está te travando agora?\"",
    emotional_approach:
      "Quebra com autoridade: \"Quando eu vou tomar uma decisão importante, eu também gosto de pensar… mas sempre com alguém que entende do assunto.\"\n\nAnalogia: \"Se fosse um assunto de direito… você ouviria um advogado ou alguém leigo? Quando o assunto é consórcio, quem vive isso todos os dias sou eu — é por isso que eu consigo te ajudar a tomar a melhor decisão, seja pra fechar ou não.\"",
    technical_approach:
      "Se continuar vago: \"Pela minha experiência, quando alguém fala que vai pensar é por dois motivos: ou não entendeu tudo, ou não fez sentido ainda. Qual dos dois é o seu caso?\"\n\nIsso força o cliente a verbalizar a objeção real (preço, cônjuge, prazo etc.) — e aí você trata a objeção de verdade.",
    video_hint: "pensar",
  },
  {
    category: "Preço / Parcela alta",
    keywords: ["caro", "preço", "preco", "valor", "parcela", "alta", "alto", "dinheiro", "pagar", "não tenho", "nao tenho", "orçamento", "orcamento", "barato", "ficou alto", "salgad"],
    quick_phrase: "É só o valor que está te impedindo?",
    logical_approach:
      "Isolamento: \"É só o valor que está te impedindo?\"\n\nDiagnóstico: \"O que exatamente ficou alto pra você?\"\n\nAjuste de parcela: \"Qual valor ficaria confortável pra você começar hoje?\" → ajusta proposta e fecha.",
    emotional_approach:
      "Se for medo de não conseguir pagar:\n\nEmpatia: \"Eu entendo isso… já deixei de tomar boas decisões por insegurança.\"\n\nQuebra: \"Você costuma não pagar suas contas ou você sempre dá um jeito?\"\n\nConclusão: \"Então você está com medo de algo que normalmente não acontece na sua vida. Vamos iniciar.\"",
    technical_approach:
      "Redução ao ridículo: \"Vamos colocar isso em perspectiva… R$600 por mês dá R$20 por dia. Isso é literalmente um café com pão. É isso que você está investindo no seu futuro.\"\n\nReforço técnico: lembre que até a contemplação a parcela é REDUZIDA — ele não paga integral enquanto não usa o crédito. Só vira cheia quando o ativo começa a gerar retorno.",
    video_hint: "preço",
  },
];

// Estrutura padrão (sempre aplicada antes da resposta específica)
const ESTRUTURA_PADRAO = `Antes de responder a objeção, ISOLE:

1. Validação de interesse: "Tudo que eu te mostrei até agora fez sentido pra você? É o que você está procurando? Está dentro do seu orçamento?"

2. Isolamento: "Além disso que você comentou, existe mais algum motivo que está te impedindo de começar agora ou é só isso?"

3. Dupla confirmação (micropacto): "Então quer dizer que, se eu resolver isso pra você agora, a gente já consegue iniciar hoje?"

⚠️ Pontos críticos: sempre isolar antes de responder · nunca responder objeção superficial · sempre fazer dupla confirmação · sempre levar pra fechamento · sempre usar pergunta (não discurso).`;

// Fallback genérico quando nada bate
const FALLBACK: Omit<ObjEntry, "keywords" | "video_hint"> = {
  category: "Objeção genérica",
  quick_phrase: "Além disso que você comentou, existe mais algum motivo que está te impedindo de começar agora ou é só isso?",
  logical_approach:
    "Não identifiquei essa objeção no playbook. Use a Estrutura Padrão (isolar → diagnosticar → dupla confirmação) pra fazer o cliente verbalizar o motivo REAL. Pela experiência DP: quando o cliente trava, normalmente é preço, cônjuge, prazo ou medo — todos têm tratamento no playbook.",
  emotional_approach:
    "Quebra com autoridade: \"Quando eu vou tomar uma decisão importante, eu também gosto de pensar… mas sempre com alguém que entende do assunto. Quando o assunto é consórcio, quem vive isso todos os dias sou eu — e é por isso que eu consigo te ajudar a tomar a melhor decisão.\"",
  technical_approach:
    "Reforce o diferencial do Novo Consórcio DP: parcela reduzida até a contemplação · 3 modalidades de lance (embutido, fixo 45%, livre ~70%) · poder de escolha (aquisição, alavancagem, investimento) · administradoras reguladas pelo BACEN com garantia FGC · DP com +12 anos de mercado e R$1bi sob gestão.",
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ");
}

function scoreEntry(objection: string, entry: ObjEntry): number {
  const norm = normalize(objection);
  let score = 0;
  for (const kw of entry.keywords) {
    const nkw = normalize(kw);
    if (norm.includes(nkw)) score += nkw.split(" ").length * 2; // multi-palavra vale mais
  }
  return score;
}

Deno.serve(async (req) => {
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
    const { objection } = await req.json();
    if (!objection || typeof objection !== "string" || objection.length < 3) {
      return new Response(JSON.stringify({ error: "Objeção inválida" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Match local
    const scored = OBJECTIONS.map((e) => ({ entry: e, score: scoreEntry(objection, e) }))
      .sort((a, b) => b.score - a.score);
    const best = scored[0];
    const matched = best && best.score > 0 ? best.entry : null;

    // Buscar vídeo de treinamento relacionado (opcional)
    let recommended_video = "";
    try {
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
      const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { data: videos } = await supabase
        .from("training_videos")
        .select("title, description, category")
        .limit(120);

      const hint = matched?.video_hint ?? "objeç";
      const nObj = normalize(objection);
      const nHint = normalize(hint);

      // 1) procura na categoria/título de "quebra de objeções"
      const objVideos = (videos || []).filter((v: any) => {
        const blob = normalize(`${v.title} ${v.description ?? ""} ${v.category ?? ""}`);
        return blob.includes("objec") || blob.includes("quebra");
      });

      // 2) prioriza o que casa com a hint OU palavra-chave da objeção
      const ranked = objVideos
        .map((v: any) => {
          const blob = normalize(`${v.title} ${v.description ?? ""}`);
          let s = 0;
          if (blob.includes(nHint)) s += 5;
          for (const word of nObj.split(/\s+/).filter((w) => w.length > 3)) {
            if (blob.includes(word)) s += 1;
          }
          return { v, s };
        })
        .sort((a, b) => b.s - a.s);

      recommended_video = ranked[0]?.v?.title ?? objVideos[0]?.title ?? "";
    } catch (err) {
      console.warn("training_videos lookup failed:", err);
    }

    const base = matched ?? { ...FALLBACK, keywords: [], video_hint: "" };

    // Se não houve match local, tenta enriquecer com IA (Lovable AI Gateway)
    let aiEnhanced = false;
    if (!matched) {
      try {
        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
        if (LOVABLE_API_KEY) {
          const systemPrompt = `Você é um especialista em vendas de consórcio da DP Consórcios. Receberá uma OBJEÇÃO de cliente que NÃO está no playbook interno. Sua missão: responder no MESMO TOM e ESTRUTURA do playbook DP, com 3 abordagens (lógica, emocional, técnica) e uma frase de quebra rápida.

REGRAS DE TOM:
- Use perguntas (não discurso) para fazer o cliente verbalizar.
- Sempre ISOLAR antes de responder ("Além disso, tem mais alguma coisa…?").
- Sempre fazer DUPLA CONFIRMAÇÃO ("Se eu resolver isso, a gente fecha hoje?").
- Reforce diferenciais DP quando útil: parcela reduzida até contemplação, 3 modalidades de lance (livre ~70%, fixo 45%, embutido até 25%), administradoras reguladas pelo BACEN, DP +12 anos de mercado.
- NUNCA invente dados, percentuais ou prazos fora desses.
- Português BR. Direto, sem emojis, sem markdown pesado.

Retorne APENAS via tool call.`;

          const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Objeção do cliente: "${objection}"` },
              ],
              tools: [{
                type: "function",
                function: {
                  name: "responder_objecao",
                  description: "Resposta estruturada à objeção no padrão playbook DP",
                  parameters: {
                    type: "object",
                    properties: {
                      category: { type: "string", description: "Nome curto da categoria da objeção (ex: 'Já tenho outros investimentos')" },
                      quick_phrase: { type: "string", description: "Frase de quebra rápida em forma de pergunta isoladora" },
                      logical_approach: { type: "string", description: "Abordagem lógica: isolar → diagnosticar → fechar (use \\n\\n entre passos)" },
                      emotional_approach: { type: "string", description: "Abordagem emocional: quebra de perspectiva + projeção futura" },
                      technical_approach: { type: "string", description: "Abordagem técnica: dados/diferenciais DP que neutralizam a objeção" },
                    },
                    required: ["category", "quick_phrase", "logical_approach", "emotional_approach", "technical_approach"],
                    additionalProperties: false,
                  },
                },
              }],
              tool_choice: { type: "function", function: { name: "responder_objecao" } },
            }),
          });

          if (aiResp.ok) {
            const aiData = await aiResp.json();
            const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];
            if (toolCall?.function?.arguments) {
              const parsed = JSON.parse(toolCall.function.arguments);
              base.category = parsed.category || base.category;
              base.quick_phrase = parsed.quick_phrase || base.quick_phrase;
              base.logical_approach = parsed.logical_approach || base.logical_approach;
              base.emotional_approach = parsed.emotional_approach || base.emotional_approach;
              base.technical_approach = parsed.technical_approach || base.technical_approach;
              aiEnhanced = true;
            }
          } else if (aiResp.status === 429) {
            console.warn("AI rate limited, using local fallback");
          } else if (aiResp.status === 402) {
            console.warn("AI credits exhausted, using local fallback");
          } else {
            console.warn("AI fallback failed:", aiResp.status, await aiResp.text());
          }
        }
      } catch (err) {
        console.warn("AI fallback error:", err);
      }
    }

    const result = {
      category: base.category,
      logical_approach: base.logical_approach,
      emotional_approach: base.emotional_approach,
      technical_approach: base.technical_approach,
      quick_phrase: base.quick_phrase,
      recommended_video,
      structure: ESTRUTURA_PADRAO,
      matched: !!matched,
      source: matched ? "playbook-local" : aiEnhanced ? "ai-fallback" : "generic-fallback",
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("playbook-respond error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});