import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Loader2, CheckCircle2, XCircle, RotateCcw, Trophy, Trash2, ClipboardPaste, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { StarRating } from "./StarRating";
import { VideoComments } from "./VideoComments";
import { PersonalNotes } from "./PersonalNotes";
import { VideoAttachments } from "./VideoAttachments";

interface QuizQuestion {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
}

interface VideoDetailProps {
  video: {
    id: string;
    title: string;
    youtube_url: string;
    description?: string | null;
    ai_summary?: string | null;
    ai_quiz?: QuizQuestion[] | null;
    ai_generated_at?: string | null;
  };
}

export default function VideoDetail({ video }: VideoDetailProps) {
  const { isAdmin } = useAdmin();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [showTranscriptInput, setShowTranscriptInput] = useState(false);
  const [manualTranscript, setManualTranscript] = useState("");

  const quiz = video.ai_quiz as QuizQuestion[] | null;

  // Load existing result
  const { data: existingResult } = useQuery({
    queryKey: ["quiz_result", video.id, user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("training_quiz_results")
        .select("*")
        .eq("video_id", video.id)
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user && !!quiz,
  });

  // Restore saved answers
  useEffect(() => {
    if (existingResult) {
      const saved = existingResult.answers as Record<string, number> | null;
      if (saved) {
        const parsed: Record<number, number> = {};
        Object.entries(saved).forEach(([k, v]) => { parsed[Number(k)] = v; });
        setAnswers(parsed);
        setSubmitted(true);
      }
    }
  }, [existingResult]);

  const generate = useMutation({
    mutationFn: async (transcript?: string) => {
      const body: Record<string, string> = { video_id: video.id, youtube_url: video.youtube_url, title: video.title, description: video.description || '' };
      if (transcript) body.manual_transcript = transcript;
      const { data, error } = await supabase.functions.invoke("training-ai-generate", { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["training_videos"] });
      setShowTranscriptInput(false);
      setManualTranscript("");
      if (data?.has_transcript) {
        toast.success("Resumo e prova gerados com base na transcrição! ✅");
      } else {
        toast.success("Resumo e prova gerados com base no título (transcrição indisponível)");
      }
    },
    onError: (e) => toast.error(e.message || "Erro ao gerar conteúdo"),
  });

  const clearSummary = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("training_videos")
        .update({ ai_summary: null, ai_quiz: null, ai_generated_at: null })
        .eq("id", video.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training_videos"] });
      toast.success("Resumo e prova excluídos!");
    },
    onError: () => toast.error("Erro ao excluir resumo"),
  });

  const saveResult = useMutation({
    mutationFn: async ({ score, total, ans }: { score: number; total: number; ans: Record<number, number> }) => {
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase
        .from("training_quiz_results")
        .upsert({
          video_id: video.id,
          user_id: user.id,
          score,
          total_questions: total,
          answers: ans,
          completed_at: new Date().toISOString(),
        }, { onConflict: "video_id,user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quiz_result", video.id] });
    },
  });

  const score = submitted && quiz
    ? quiz.filter((q, i) => answers[i] === q.correct).length
    : 0;

  const handleSubmit = () => {
    setSubmitted(true);
    if (quiz) {
      const s = quiz.filter((q, i) => answers[i] === q.correct).length;
      saveResult.mutate({ score: s, total: quiz.length, ans: answers });
    }
  };

  const handleRetry = () => {
    setAnswers({});
    setSubmitted(false);
  };

  return (
    <div className="space-y-4 mt-3">
      {isAdmin && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => generate.mutate(undefined)} disabled={generate.isPending || clearSummary.isPending} className="gap-2">
              {generate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {video.ai_summary ? "Regenerar Resumo + Prova" : "Gerar Resumo + Prova com IA"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTranscriptInput(!showTranscriptInput)}
              disabled={generate.isPending}
              className="gap-2"
            >
              <ClipboardPaste className="h-4 w-4" />
              Colar Transcrição
              {showTranscriptInput ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
            {video.ai_summary && (
              <Button variant="ghost" size="sm" onClick={() => clearSummary.mutate()} disabled={clearSummary.isPending || generate.isPending} className="gap-2 text-destructive hover:text-destructive">
                {clearSummary.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Excluir Resumo
              </Button>
            )}
          </div>
          {showTranscriptInput && (
            <Card>
              <CardContent className="p-3 space-y-2">
                <p className="text-xs text-muted-foreground">
                  Cole a transcrição do vídeo abaixo. A IA usará esse texto para gerar o resumo e a prova.
                </p>
                <Textarea
                  value={manualTranscript}
                  onChange={(e) => setManualTranscript(e.target.value)}
                  placeholder="Cole aqui a transcrição do vídeo..."
                  rows={6}
                  className="text-xs"
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {manualTranscript.length > 0 ? `${manualTranscript.length} caracteres` : ""}
                  </span>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (manualTranscript.trim().length < 50) {
                        toast.error("A transcrição precisa ter pelo menos 50 caracteres");
                        return;
                      }
                      generate.mutate(manualTranscript.trim());
                    }}
                    disabled={generate.isPending || manualTranscript.trim().length < 50}
                    className="gap-2"
                  >
                    {generate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    Gerar com essa Transcrição
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {video.ai_summary && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Resumo do Treinamento
            </h4>
            <div className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
              {video.ai_summary}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Previous result badge */}
      {existingResult && !submitted && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Trophy className="h-4 w-4 text-primary" />
          Última nota: <Badge variant="secondary">{existingResult.score}/{existingResult.total_questions}</Badge>
        </div>
      )}

      {quiz && quiz.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm text-foreground">📝 Prova — {quiz.length} questões</h4>
              {submitted && (
                <div className="flex items-center gap-2">
                  <Badge variant={score >= 7 ? "default" : "destructive"}>{score}/{quiz.length}</Badge>
                  <Button variant="ghost" size="sm" onClick={handleRetry} className="h-7 gap-1">
                    <RotateCcw className="h-3 w-3" /> Refazer
                  </Button>
                </div>
              )}
            </div>

            {quiz.map((q, qi) => (
              <div key={qi} className="space-y-2">
                <p className="text-sm font-medium text-foreground">{qi + 1}. {q.question}</p>
                <div className="grid gap-1.5">
                  {q.options.map((opt, oi) => {
                    const selected = answers[qi] === oi;
                    const isCorrect = oi === q.correct;
                    let className = "text-left text-sm px-3 py-2 rounded-md border transition-colors ";
                    if (submitted) {
                      if (isCorrect) className += "border-green-500 bg-green-500/10 text-green-700 dark:text-green-400";
                      else if (selected && !isCorrect) className += "border-red-500 bg-red-500/10 text-red-700 dark:text-red-400";
                      else className += "border-border text-muted-foreground opacity-60";
                    } else {
                      className += selected ? "border-primary bg-primary/10 text-foreground" : "border-border text-foreground hover:border-primary/50";
                    }
                    return (
                      <button key={oi} className={className} disabled={submitted} onClick={() => setAnswers((prev) => ({ ...prev, [qi]: oi }))}>
                        <span className="font-medium mr-2">{String.fromCharCode(65 + oi)})</span>
                        {opt}
                        {submitted && isCorrect && <CheckCircle2 className="inline h-3.5 w-3.5 ml-1" />}
                        {submitted && selected && !isCorrect && <XCircle className="inline h-3.5 w-3.5 ml-1" />}
                      </button>
                    );
                  })}
                </div>
                {submitted && answers[qi] !== undefined && (
                  <p className="text-xs text-muted-foreground italic pl-2">💡 {q.explanation}</p>
                )}
              </div>
            ))}

            {!submitted && (
              <Button onClick={handleSubmit} disabled={Object.keys(answers).length < quiz.length} className="w-full">
                Enviar Respostas ({Object.keys(answers).length}/{quiz.length})
              </Button>
            )}

            {submitted && (
              <div className={`text-center p-3 rounded-lg ${score >= 7 ? "bg-green-500/10" : "bg-red-500/10"}`}>
                <p className="font-semibold text-foreground">
                  {score >= 7 ? "🎉 Parabéns!" : "📚 Continue estudando!"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Você acertou {score} de {quiz.length} questões ({Math.round((score / quiz.length) * 100)}%)
                </p>
                {saveResult.isPending && <p className="text-xs text-muted-foreground mt-1">Salvando resultado...</p>}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Interactive features */}
      <div className="border-t pt-4 space-y-4">
        <StarRating videoId={video.id} />
        <VideoAttachments videoId={video.id} />
        <PersonalNotes videoId={video.id} />
        <VideoComments videoId={video.id} />
      </div>
    </div>
  );
}
