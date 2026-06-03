import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { usePlaybook, type PlaybookResponse, type PlaybookEntry } from "@/hooks/usePlaybook";
import { usePlaybookContributions, type PlaybookContribution } from "@/hooks/usePlaybookContributions";
import { Sparkles, Brain, Heart, Wrench, Quote, BookOpen, Share2, Trash2, Loader2, History, Upload, FileText, Download, Paperclip } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Playbook() {
  const { history, shared, generating, generate, toggleShare, remove } = usePlaybook();
  const [objection, setObjection] = useState("");
  const [current, setCurrent] = useState<PlaybookResponse | null>(null);

  const handleGenerate = async () => {
    if (objection.trim().length < 5) return;
    const res = await generate(objection.trim());
    if (res) setCurrent(res);
  };

  return (
    <div className="container max-w-6xl py-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground">
          <Sparkles className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Playbook de Objeções</h1>
          <p className="text-muted-foreground">IA + acervo de treinamentos pra responder qualquer objeção</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Qual a objeção do cliente?</CardTitle>
          <CardDescription>Digite com as palavras dele. Quanto mais específico, melhor a resposta.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={objection}
            onChange={(e) => setObjection(e.target.value)}
            placeholder='Ex: "Achei caro, prefiro financiamento" ou "Tenho medo de não ser contemplado"'
            rows={4}
            className="resize-none"
          />
          <div className="flex justify-end">
            <Button onClick={handleGenerate} disabled={generating || objection.trim().length < 5} size="lg">
              {generating ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gerando...</>) : (<><Sparkles className="h-4 w-4 mr-2" /> Gerar resposta</>)}
            </Button>
          </div>
        </CardContent>
      </Card>

      {current && <ResponseCard response={current} />}

      <Tabs defaultValue="history">
        <TabsList>
          <TabsTrigger value="history"><History className="h-4 w-4 mr-2" /> Meu histórico ({history.length})</TabsTrigger>
          <TabsTrigger value="shared"><BookOpen className="h-4 w-4 mr-2" /> Biblioteca da equipe ({shared.length})</TabsTrigger>
          <TabsTrigger value="contrib"><Paperclip className="h-4 w-4 mr-2" /> Contribuições</TabsTrigger>
        </TabsList>
        <TabsContent value="history" className="space-y-3 mt-4">
          {history.length === 0 && <EmptyState text="Nenhuma objeção pesquisada ainda." />}
          {history.map((e) => <EntryCard key={e.id} entry={e} onShare={toggleShare} onRemove={remove} canManage />)}
        </TabsContent>
        <TabsContent value="shared" className="space-y-3 mt-4">
          {shared.length === 0 && <EmptyState text="Nenhuma resposta compartilhada ainda. Compartilhe as boas pra ajudar a equipe!" />}
          {shared.map((e) => <EntryCard key={e.id} entry={e} onShare={toggleShare} onRemove={remove} />)}
        </TabsContent>
        <TabsContent value="contrib" className="space-y-4 mt-4">
          <ContributionsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ResponseCard({ response }: { response: PlaybookResponse }) {
  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Resposta sugerida</CardTitle>
          <div className="flex items-center gap-2">
            {response.source === "ai-fallback" && (
              <Badge variant="outline" className="border-primary/40 text-primary text-xs">
                <Sparkles className="h-3 w-3 mr-1" /> Gerada por IA
              </Badge>
            )}
            <Badge variant="secondary" className="capitalize">{response.category}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-primary/10 border border-primary/20 p-4">
          <div className="flex items-start gap-2">
            <Quote className="h-4 w-4 text-primary mt-1 shrink-0" />
            <p className="font-semibold text-base">{response.quick_phrase}</p>
          </div>
        </div>
        <Approach icon={<Brain className="h-4 w-4" />} title="Lógica" text={response.logical_approach} />
        <Approach icon={<Heart className="h-4 w-4" />} title="Emocional" text={response.emotional_approach} />
        <Approach icon={<Wrench className="h-4 w-4" />} title="Técnica" text={response.technical_approach} />
        {response.recommended_video && (
          <div className="flex items-start gap-2 p-3 rounded-md bg-muted/50">
            <BookOpen className="h-4 w-4 mt-0.5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Treinamento recomendado</p>
              <p className="text-sm font-medium">{response.recommended_video}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Approach({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1 text-sm font-semibold text-primary">{icon} {title}</div>
      <p className="text-sm text-muted-foreground leading-relaxed">{text}</p>
    </div>
  );
}

function EntryCard({ entry, onShare, onRemove, canManage }: { entry: PlaybookEntry; onShare: (id: string, shared: boolean) => void; onRemove: (id: string) => void; canManage?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <CardHeader className="pb-3 cursor-pointer" onClick={() => setOpen(!open)}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-medium line-clamp-2">{entry.objection_text}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true, locale: ptBR })}
              {entry.ai_response?.category && <> · <span className="capitalize">{entry.ai_response.category}</span></>}
            </p>
          </div>
          {canManage && (
            <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
              <Button size="sm" variant={entry.shared ? "default" : "ghost"} onClick={() => onShare(entry.id, !entry.shared)} title={entry.shared ? "Remover da biblioteca" : "Compartilhar com equipe"}>
                <Share2 className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onRemove(entry.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      {open && entry.ai_response && (
        <CardContent className="pt-0">
          <Separator className="mb-4" />
          <ResponseCard response={entry.ai_response} />
        </CardContent>
      )}
    </Card>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="text-center py-12 text-muted-foreground text-sm">{text}</div>;
}

function formatBytes(b: number | null) {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function ContributionsTab() {
  const { items, loading, uploading, upload, remove, currentUserId } = usePlaybookContributions();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const handleSubmit = async () => {
    if (!file) return;
    const ok = await upload(file, title, description);
    if (ok) {
      setTitle(""); setDescription(""); setFile(null);
      const input = document.getElementById("playbook-contrib-file") as HTMLInputElement | null;
      if (input) input.value = "";
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Upload className="h-5 w-5 text-primary" /> Contribuir com um arquivo</CardTitle>
          <CardDescription>Envie PDFs, planilhas, áudios ou documentos com objeções, scripts e respostas que ajudaram a equipe (até 20 MB).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Título (ex: Quebra de objeção 'vou pensar')"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Textarea
            placeholder="Descrição (opcional) — contexto, situação, dica de uso…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="resize-none"
          />
          <Input
            id="playbook-contrib-file"
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {file && (
            <p className="text-xs text-muted-foreground">
              {file.name} · {formatBytes(file.size)}
            </p>
          )}
          <div className="flex justify-end">
            <Button onClick={handleSubmit} disabled={uploading || !file || !title.trim()}>
              {uploading ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...</>) : (<><Upload className="h-4 w-4 mr-2" /> Enviar contribuição</>)}
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading && <EmptyState text="Carregando contribuições..." />}
      {!loading && items.length === 0 && <EmptyState text="Nenhuma contribuição ainda. Seja o primeiro a compartilhar algo útil!" />}
      {!loading && items.length > 0 && (
        <div className="space-y-2">
          {items.map((c) => (
            <ContributionCard key={c.id} item={c} canManage={c.user_id === currentUserId} onRemove={() => remove(c)} />
          ))}
        </div>
      )}
    </div>
  );
}

function ContributionCard({ item, canManage, onRemove }: { item: PlaybookContribution; canManage: boolean; onRemove: () => void }) {
  return (
    <Card>
      <CardContent className="py-4 flex items-start gap-3">
        <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
          <FileText className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{item.title}</p>
          {item.description && <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">{item.description}</p>}
          <p className="text-xs text-muted-foreground mt-1">
            {item.author_name || "Usuário"} · {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: ptBR })}
            {item.file_size ? <> · {formatBytes(item.file_size)}</> : null}
          </p>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button asChild size="sm" variant="ghost" title="Baixar">
            <a href={item.file_url} target="_blank" rel="noopener noreferrer" download>
              <Download className="h-4 w-4" />
            </a>
          </Button>
          {canManage && (
            <Button size="sm" variant="ghost" onClick={onRemove} title="Remover">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}