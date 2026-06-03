import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Loader2, Sparkles, Check, X } from "lucide-react";
import { toast } from "sonner";
import type { OKRMode } from "@/hooks/useOKRData";

interface ParsedOKR {
  existing_department_id?: string;
  new_department?: { name: string; icon: string };
  objectives: Array<{
    title: string;
    key_results: Array<{ title: string }>;
  }>;
  error?: string;
}

interface ExistingDept {
  id: string;
  name: string;
  icon: string;
}

interface VoiceOKRInputProps {
  mode: OKRMode;
  existingDepartments: ExistingDept[];
  onCreated: () => void;
}

export function VoiceOKRInput({ mode, existingDepartments, onCreated }: VoiceOKRInputProps) {
  const { user } = useAuth();
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [parsed, setParsed] = useState<ParsedOKR | null>(null);
  const recognitionRef = useRef<any>(null);

  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Seu navegador não suporta reconhecimento de voz. Use Chrome ou Edge.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "pt-BR";
    recognition.continuous = true;
    recognition.interimResults = true;

    let finalTranscript = "";

    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + " ";
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setTranscript(finalTranscript + interim);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech error:", event.error);
      if (event.error !== "no-speech") {
        toast.error("Erro no reconhecimento de voz");
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      if (finalTranscript.trim()) {
        setTranscript(finalTranscript.trim());
        processWithAI(finalTranscript.trim());
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    setTranscript("");
    setParsed(null);
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  const processWithAI = async (text: string) => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("parse-okr-voice", {
        body: {
          transcript: text,
          mode,
          existingDepartments: existingDepartments.map((d) => ({
            id: d.id,
            name: d.name,
            icon: d.icon,
          })),
        },
      });

      if (error) throw error;

      if (data.error) {
        toast.error(data.error);
        return;
      }

      setParsed(data);
    } catch (e) {
      console.error("AI processing error:", e);
      toast.error("Erro ao processar com IA");
    } finally {
      setIsProcessing(false);
    }
  };

  const confirmAndCreate = async () => {
    if (!parsed || !user) return;
    setIsProcessing(true);

    try {
      let deptId = parsed.existing_department_id;

      // Create new department if needed
      if (!deptId && parsed.new_department) {
        const id = parsed.new_department.name
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, "") + "-" + Date.now();

        const insertData: any = {
          id,
          name: parsed.new_department.name,
          icon: parsed.new_department.icon || "📋",
          sort_order: existingDepartments.length + 1,
        };
        if (mode === "personal") insertData.user_id = user.id;

        const { error } = await supabase.from("departments").insert(insertData);
        if (error) throw error;
        deptId = id;
      }

      if (!deptId) {
        toast.error("Departamento não identificado");
        return;
      }

      // Create objectives and key results
      for (let i = 0; i < parsed.objectives.length; i++) {
        const obj = parsed.objectives[i];
        const objId = `${deptId}-obj-${Date.now()}-${i}`;

        const { error: objError } = await supabase.from("objectives").insert({
          id: objId,
          department_id: deptId,
          title: obj.title,
          sort_order: i + 1,
        });
        if (objError) throw objError;

        for (let j = 0; j < obj.key_results.length; j++) {
          const kr = obj.key_results[j];
          const { error: krError } = await supabase.from("key_results").insert({
            id: `kr-${Date.now()}-${i}-${j}`,
            objective_id: objId,
            title: kr.title,
            sort_order: j + 1,
          });
          if (krError) throw krError;
        }
      }

      toast.success("OKRs criados com sucesso! 🎉");
      setParsed(null);
      setTranscript("");
      onCreated();
    } catch (e) {
      console.error("Create error:", e);
      toast.error("Erro ao criar OKRs");
    } finally {
      setIsProcessing(false);
    }
  };

  const cancel = () => {
    setParsed(null);
    setTranscript("");
  };

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-primary" />
        <h2 className="font-display font-semibold text-foreground">Criar OKR por Voz + IA</h2>
      </div>

      <p className="text-sm text-muted-foreground">
        Fale algo como: "Criar objetivo de vendas com meta de 100 clientes e faturamento de 1 milhão"
      </p>

      {/* Mic button */}
      <div className="flex items-center gap-3">
        <Button
          onClick={isListening ? stopListening : startListening}
          disabled={isProcessing}
          variant={isListening ? "destructive" : "default"}
          size="lg"
          className="gap-2"
        >
          {isListening ? (
            <>
              <MicOff className="w-5 h-5" />
              Parar
            </>
          ) : isProcessing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Processando...
            </>
          ) : (
            <>
              <Mic className="w-5 h-5" />
              Falar
            </>
          )}
        </Button>

        {isListening && (
          <span className="flex items-center gap-2 text-sm text-destructive animate-pulse">
            <span className="w-2 h-2 rounded-full bg-destructive" />
            Ouvindo...
          </span>
        )}
      </div>

      {/* Transcript */}
      {transcript && (
        <div className="rounded-lg bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground mb-1">Transcrição:</p>
          <p className="text-sm text-foreground">{transcript}</p>
        </div>
      )}

      {/* Parsed preview */}
      {parsed && !parsed.error && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
          <p className="text-sm font-medium text-primary">Prévia do que será criado:</p>

          {parsed.new_department && (
            <div className="text-sm">
              <span className="text-muted-foreground">Novo departamento: </span>
              <span className="font-medium">{parsed.new_department.icon} {parsed.new_department.name}</span>
            </div>
          )}

          {parsed.existing_department_id && (
            <div className="text-sm">
              <span className="text-muted-foreground">Departamento: </span>
              <span className="font-medium">
                {existingDepartments.find((d) => d.id === parsed.existing_department_id)?.name || parsed.existing_department_id}
              </span>
            </div>
          )}

          {parsed.objectives.map((obj, i) => (
            <div key={i} className="ml-2 space-y-1">
              <p className="text-sm font-medium">📌 {obj.title}</p>
              <ul className="ml-4 space-y-0.5">
                {obj.key_results.map((kr, j) => (
                  <li key={j} className="text-sm text-muted-foreground">• {kr.title}</li>
                ))}
              </ul>
            </div>
          ))}

          <div className="flex gap-2 pt-2">
            <Button onClick={confirmAndCreate} disabled={isProcessing} size="sm" className="gap-1">
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Confirmar e Criar
            </Button>
            <Button onClick={cancel} variant="outline" size="sm" className="gap-1">
              <X className="w-4 h-4" /> Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
