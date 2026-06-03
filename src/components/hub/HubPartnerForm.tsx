import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { HubPartner } from "@/hooks/useHubData";
import { buildGoogleCalendarUrl } from "@/lib/google-calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Calendar } from "lucide-react";

interface AutocompleteInputProps {
  placeholder: string;
  value: string;
  onChange: (val: string) => void;
  suggestions: string[];
  type?: string;
  onSelect?: (val: string) => void;
}

function AutocompleteInput({ placeholder, value, onChange, suggestions, type, onSelect }: AutocompleteInputProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!value || value.length < 1) return [];
    const lower = value.toLowerCase();
    return suggestions.filter((s) => s.toLowerCase().includes(lower)).slice(0, 6);
  }, [value, suggestions]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <Input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-40 overflow-y-auto">
          {filtered.map((s) => (
            <button
              key={s}
              type="button"
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors truncate"
              onClick={() => { if (onSelect) { onSelect(s); } else { onChange(s); } setOpen(false); }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const ETAPAS = [
  "Apresentação",
  "Reunião Agendada",
  "Envio de Documentos",
  "Análise Cadastral",
  "Implantação",
  "Ativo",
];

const STATUS_OPTIONS = ["Aguardando", "Enviado", "Pendente", "Aprovado"];

interface HubPartnerFormProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  partner?: HubPartner | null;
  onSaved: () => void;
}

export function HubPartnerForm({ open, onOpenChange, partner, onSaved }: HubPartnerFormProps) {
  const [saving, setSaving] = useState(false);

  const [nome, setNome] = useState("");
  const [escritorio, setEscritorio] = useState("");
  const [cidade, setCidade] = useState("");
  const [etapa, setEtapa] = useState("Apresentação");
  
  const [prazo, setPrazo] = useState("");

  const [statusMag, setStatusMag] = useState("Aguardando");
  const [docsMag, setDocsMag] = useState("");
  const [obsMag, setObsMag] = useState("");

  const [statusAnc, setStatusAnc] = useState("Aguardando");
  const [docsAnc, setDocsAnc] = useState("");
  const [obsAnc, setObsAnc] = useState("");

  const [statusCan, setStatusCan] = useState("Aguardando");
  const [docsCan, setDocsCan] = useState("");
  const [obsCan, setObsCan] = useState("");

  const [metaMag, setMetaMag] = useState("100000");
  const [metaAnc, setMetaAnc] = useState("80000");
  const [metaCan, setMetaCan] = useState("60000");

  const [proxAcao, setProxAcao] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [emailMembro, setEmailMembro] = useState("");
  const [emailAfiliado, setEmailAfiliado] = useState("");
  const [origem, setOrigem] = useState<string>("");
  const [origens, setOrigens] = useState<{ id: string; nome: string }[]>([]);

  // Scheduling state
  const [agendData, setAgendData] = useState("");
  const [agendHora, setAgendHora] = useState("10:00");
  const [agendDuracao, setAgendDuracao] = useState("60");
  const [agendTitulo, setAgendTitulo] = useState("");
  const [agendConvidados, setAgendConvidados] = useState<string[]>([]);
  const [agendConvidadoInput, setAgendConvidadoInput] = useState("");

  const [members, setMembers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [systemEmails, setSystemEmails] = useState<string[]>([]);
  useEffect(() => {
    if (!open) return;
    const fetchMembers = async () => {
      const { data: profiles } = await supabase.from("profiles").select("user_id, display_name, email") as { data: { user_id: string; display_name: string | null; email: string | null }[] | null };
      
      const memberList: { id: string; name: string; email: string }[] = [];
      const emails = new Set<string>();
      if (profiles) {
        for (const p of profiles) {
          const email = p.email || "";
          memberList.push({ id: p.user_id, name: p.display_name || "Sem nome", email });
          if (email) emails.add(email);
        }
      }

      setMembers(memberList);
      setSystemEmails(Array.from(emails).sort());

      const { data: orig } = await (supabase as any).from("hub_origens").select("id, nome").order("nome");
      if (orig) setOrigens(orig);
    };
    fetchMembers();
  }, [open]);

  // origens são gerenciadas apenas pelo botão "Origens" no header do Hub


  // Sync form state whenever partner or open changes
  useEffect(() => {
    if (open && partner) {
      setNome(partner.nome);
      setEscritorio(partner.escritorio || "");
      setCidade(partner.cidade || "");
      setEtapa(partner.etapa);
      
      setPrazo(partner.prazo || "");
      setStatusMag(partner.status_mag || "Aguardando");
      setDocsMag(partner.docs_mag || "");
      setObsMag(partner.obs_mag || "");
      setStatusAnc(partner.status_anc || "Aguardando");
      setDocsAnc(partner.docs_anc || "");
      setObsAnc(partner.obs_anc || "");
      setStatusCan(partner.status_can || "Aguardando");
      setDocsCan(partner.docs_can || "");
      setObsCan(partner.obs_can || "");
      setMetaMag(String(partner.meta_mag ?? 100000));
      setMetaAnc(String(partner.meta_anc ?? 80000));
      setMetaCan(String(partner.meta_can ?? 60000));
      setProxAcao(partner.prox_acao || "");
      setResponsavel(partner.responsavel || "");
      setEmailMembro((partner as any).email_membro || "");
      setEmailAfiliado((partner as any).email_afiliado || "");
      setOrigem((partner as any).origem || "");
    } else if (open && !partner) {
      setNome(""); setEscritorio(""); setCidade("");
      setEtapa("Apresentação"); setPrazo("");
      setStatusMag("Aguardando"); setDocsMag(""); setObsMag("");
      setStatusAnc("Aguardando"); setDocsAnc(""); setObsAnc("");
      setStatusCan("Aguardando"); setDocsCan(""); setObsCan("");
      setMetaMag("100000"); setMetaAnc("80000"); setMetaCan("60000");
      setProxAcao(""); setResponsavel(""); setEmailMembro(""); setEmailAfiliado("");
      setOrigem("");
    }
  }, [open, partner]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const payload = {
      nome,
      escritorio: escritorio || null,
      cidade: cidade || null,
      etapa,
      
      prazo: prazo || null,
      status_mag: statusMag,
      docs_mag: docsMag || null,
      obs_mag: obsMag || null,
      status_anc: statusAnc,
      docs_anc: docsAnc || null,
      obs_anc: obsAnc || null,
      status_can: statusCan,
      docs_can: docsCan || null,
      obs_can: obsCan || null,
      meta_mag: Number(metaMag) || 0,
      meta_anc: Number(metaAnc) || 0,
      meta_can: Number(metaCan) || 0,
      prox_acao: proxAcao || null,
      responsavel: (responsavel && responsavel !== "__none") ? responsavel : null,
      email_membro: emailMembro || null,
      email_afiliado: emailAfiliado || null,
      origem: origem || null,
    };

    let error;
    if (partner) {
      ({ error } = await supabase.from("hub_partners").update(payload as any).eq("id", partner.id));
    } else {
      ({ error } = await supabase.from("hub_partners").insert(payload as any));
    }

    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar parceiro");
      console.error(error);
      return;
    }
    toast.success(partner ? "Parceiro atualizado!" : "Parceiro adicionado!");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{partner ? "Editar Parceiro" : "Novo Parceiro"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Basic info */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dados do Parceiro</h4>
            <Input placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Escritório" value={escritorio} onChange={(e) => setEscritorio(e.target.value)} />
              <Input placeholder="Cidade/UF" value={cidade} onChange={(e) => setCidade(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Select value={etapa} onValueChange={setEtapa}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ETAPAS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
            </div>

            {/* Origem (Tag) */}
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Origem (Tag)</Label>
              <Select value={origem || "__none"} onValueChange={(v) => setOrigem(v === "__none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecionar origem" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Sem origem</SelectItem>
                  {origens.map((o) => (
                    <SelectItem key={o.id} value={o.nome}>{o.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[9px] text-muted-foreground/60">
                Para cadastrar/excluir origens, use o botão "Origens" no topo do HUB.
              </p>
            </div>
          </div>

          {/* Admin statuses */}
          {[
            { label: "🔵 Magalu", status: statusMag, setStatus: setStatusMag, docs: docsMag, setDocs: setDocsMag, obs: obsMag, setObs: setObsMag },
            { label: "🔴 Âncora", status: statusAnc, setStatus: setStatusAnc, docs: docsAnc, setDocs: setDocsAnc, obs: obsAnc, setObs: setObsAnc },
            { label: "🟢 Canopus", status: statusCan, setStatus: setStatusCan, docs: docsCan, setDocs: setDocsCan, obs: obsCan, setObs: setObsCan },
          ].map((adm) => (
            <div key={adm.label} className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground">{adm.label}</h4>
              <div className="grid grid-cols-2 gap-2">
                <Select value={adm.status} onValueChange={adm.setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input placeholder="Docs" value={adm.docs} onChange={(e) => adm.setDocs(e.target.value)} />
              </div>
              <Input placeholder="Observação" value={adm.obs} onChange={(e) => adm.setObs(e.target.value)} />
            </div>
          ))}

          {/* Metas */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Metas (R$)</h4>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-[10px]">Magalu</Label>
                <Input type="number" value={metaMag} onChange={(e) => setMetaMag(e.target.value)} />
              </div>
              <div>
                <Label className="text-[10px]">Âncora</Label>
                <Input type="number" value={metaAnc} onChange={(e) => setMetaAnc(e.target.value)} />
              </div>
              <div>
                <Label className="text-[10px]">Canopus</Label>
                <Input type="number" value={metaCan} onChange={(e) => setMetaCan(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Gestão */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Gestão</h4>
            <Textarea placeholder="Próxima ação" value={proxAcao} onChange={(e) => setProxAcao(e.target.value)} rows={2} />
            <div>
              <Label className="text-[10px]">Responsável</Label>
              <Select value={responsavel || "__none"} onValueChange={(v) => setResponsavel(v === "__none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar responsável" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Nenhum</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px]">E-mail do membro</Label>
                <AutocompleteInput
                  type="email"
                  placeholder="Digite ou selecione..."
                  value={emailMembro}
                  onChange={setEmailMembro}
                  suggestions={systemEmails}
                  onSelect={(val) => setEmailMembro(val)}
                />
                <p className="text-[9px] text-muted-foreground/60 mt-0.5">Selecione existente ou digite novo</p>
              </div>
              <div>
                <Label className="text-[10px]">E-mail do afiliado</Label>
                <AutocompleteInput
                  type="email"
                  placeholder="Digite ou selecione..."
                  value={emailAfiliado}
                  onChange={setEmailAfiliado}
                  suggestions={systemEmails}
                  onSelect={(val) => setEmailAfiliado(val)}
                />
                <p className="text-[9px] text-muted-foreground/60 mt-0.5">Selecione existente ou digite novo</p>
              </div>
            </div>
          </div>

          {/* Agendamento */}
          <div className="space-y-2 border border-border/50 rounded-lg p-3 bg-accent/20">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> Agendamento Google Calendar
              </h4>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px]">Data</Label>
                <Input type="date" value={agendData} onChange={(e) => setAgendData(e.target.value)} />
              </div>
              <div>
                <Label className="text-[10px]">Hora</Label>
                <Input type="time" value={agendHora} onChange={(e) => setAgendHora(e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="text-[10px]">Duração</Label>
              <Select value={agendDuracao} onValueChange={setAgendDuracao}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="60">1 hora</SelectItem>
                  <SelectItem value="90">1h30</SelectItem>
                  <SelectItem value="120">2 horas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px]">Título do evento</Label>
              <Input
                placeholder={`Reunião — ${nome || "Parceiro"}`}
                value={agendTitulo}
                onChange={(e) => setAgendTitulo(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-[10px]">Convidados (e-mails cadastrados)</Label>
              <div className="flex gap-1.5 flex-wrap mb-1.5">
                {agendConvidados.map((email) => (
                  <span key={email} className="inline-flex items-center gap-1 bg-primary/20 text-primary text-[10px] px-2 py-0.5 rounded-full">
                    {email}
                    <button type="button" className="hover:text-destructive" onClick={() => setAgendConvidados(prev => prev.filter(e => e !== email))}>×</button>
                  </span>
                ))}
              </div>
              <AutocompleteInput
                type="email"
                placeholder="Adicionar convidado..."
                value={agendConvidadoInput}
                onChange={(val) => setAgendConvidadoInput(val)}
                suggestions={systemEmails.filter(s => s.includes("@") && !agendConvidados.includes(s))}
                onSelect={(val) => {
                  if (val.includes("@") && !agendConvidados.includes(val)) {
                    setAgendConvidados(prev => [...prev, val]);
                    setAgendConvidadoInput("");
                  }
                }}
              />
              {emailMembro && !agendConvidados.includes(emailMembro) && (
                <button type="button" className="text-[10px] text-primary mt-1 hover:underline" onClick={() => setAgendConvidados(prev => [...prev, emailMembro])}>
                  + Membro: {emailMembro}
                </button>
              )}
              {emailAfiliado && !agendConvidados.includes(emailAfiliado) && (
                <button type="button" className="text-[10px] text-primary mt-1 ml-3 hover:underline" onClick={() => setAgendConvidados(prev => [...prev, emailAfiliado])}>
                  + Afiliado: {emailAfiliado}
                </button>
              )}
            </div>

            {agendData ? (
              <Button
                type="button"
                variant="default"
                size="sm"
                className="w-full text-xs gap-1.5"
                onClick={() => {
                  const startDate = new Date(`${agendData}T${agendHora}:00`);
                  const endDate = new Date(startDate.getTime() + Number(agendDuracao) * 60 * 1000);
                  const url = buildGoogleCalendarUrl({
                    title: agendTitulo || `Reunião — ${nome || "Parceiro"}`,
                    description: [
                      `Parceiro: ${nome}`,
                      escritorio ? `Escritório: ${escritorio}` : "",
                      etapa ? `Etapa: ${etapa}` : "",
                      responsavel ? `Responsável: ${responsavel}` : "",
                      "",
                      "Gerado pelo HUB — DP Consórcios",
                    ].filter(Boolean).join("\n"),
                    startDate,
                    endDate,
                    guests: agendConvidados,
                  });
                  window.open(url, "_blank");
                }}
              >
                <Calendar className="w-3.5 h-3.5" />
                Abrir no Google Calendar
              </Button>
            ) : (
              <p className="text-[10px] text-muted-foreground/60 text-center">Selecione uma data para agendar</p>
            )}
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Salvando..." : partner ? "Salvar" : "Adicionar"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
