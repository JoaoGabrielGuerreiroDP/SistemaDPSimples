import { useMemo, useState } from "react";
import { Calculator } from "lucide-react";

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    isFinite(v) ? v : 0
  );

type Modo = "percentual" | "dinheiro";

export default function CalculadoraLance() {
  const [credito, setCredito] = useState<number>(100000);
  const [taxaAdm, setTaxaAdm] = useState<number>(23);
  const [jaPago, setJaPago] = useState<number>(0);
  const [prazoRestante, setPrazoRestante] = useState<number>(180);
  const [modo, setModo] = useState<Modo>("percentual");
  const [percentualLance, setPercentualLance] = useState<number>(35);
  const [dinheiroLance, setDinheiroLance] = useState<number>(10000);
  const [embutidoPct, setEmbutidoPct] = useState<25 | 30>(30);

  const calc = useMemo(() => {
    const FUNDO_RESERVA = 0.01; // 1% fixo
    const saldoInicial = credito * (1 + taxaAdm / 100 + FUNDO_RESERVA);
    const embutidoMax = credito * (embutidoPct / 100);

    let lanceTotal = 0;
    let embutidoUsado = 0;
    let recursosProprios = 0;
    let lancePct = 0;
    let alerta = "";

    if (modo === "percentual") {
      lanceTotal = credito * (percentualLance / 100);
      embutidoUsado = Math.min(lanceTotal, embutidoMax);
      recursosProprios = Math.max(0, lanceTotal - embutidoMax);
      lancePct = percentualLance;
      if (percentualLance < embutidoPct && percentualLance > 0) {
        alerta = `Atenção: o lance ofertado (${percentualLance}%) é menor que o embutido selecionado (${embutidoPct}%). Apenas ${percentualLance}% será usado do crédito como embutido.`;
      }
    } else {
      recursosProprios = dinheiroLance;
      embutidoUsado = embutidoMax;
      lanceTotal = embutidoUsado + recursosProprios;
      lancePct = credito > 0 ? (lanceTotal / credito) * 100 : 0;
    }

    const creditoLiquido = credito - embutidoUsado;
    const saldoPos = saldoInicial - jaPago - lanceTotal;
    const novaParcela = prazoRestante > 0 ? saldoPos / prazoRestante : 0;

    if (saldoPos < 0 && !alerta) {
      alerta = "Atenção: o lance + valor pago supera o saldo devedor. Revise os valores.";
    }

    return {
      saldoInicial,
      lanceTotal,
      lancePct,
      embutidoUsado,
      recursosProprios,
      creditoLiquido,
      saldoRestante: Math.max(0, saldoPos),
      novaParcela: Math.max(0, novaParcela),
      alerta,
    };
  }, [credito, taxaAdm, jaPago, prazoRestante, modo, percentualLance, dinheiroLance, embutidoPct]);

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Calculator className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-xl font-bold text-foreground">Calculadora de Lance</h1>
          <p className="text-xs text-muted-foreground">DP Consórcios · Simulação de contemplação por lance</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Inputs */}
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-1 h-5 bg-primary rounded" />
            <h2 className="font-semibold text-foreground">Dados do consórcio</h2>
          </div>

          <Field label="Valor do crédito (R$)">
            <NumberInput value={credito} onChange={setCredito} />
          </Field>

          <Field
            label="Taxa administrativa (%)"
            hint="+ 1% fundo de reserva fixo"
          >
            <NumberInput value={taxaAdm} onChange={setTaxaAdm} step={0.1} />
          </Field>

          <Field label="Valor já pago em parcelas (R$)">
            <NumberInput value={jaPago} onChange={setJaPago} />
          </Field>

          <Field label="Prazo restante do grupo (meses)">
            <NumberInput value={prazoRestante} onChange={setPrazoRestante} step={1} />
          </Field>

          <div>
            <p className="text-sm text-foreground mb-2">Modo de oferta de lance</p>
            <div className="grid grid-cols-2 gap-2 rounded-md bg-muted/40 p-1">
              <button
                onClick={() => setModo("percentual")}
                className={`text-sm py-2 rounded-md transition-colors ${
                  modo === "percentual" ? "bg-background shadow-sm font-medium" : "text-muted-foreground"
                }`}
              >
                Percentual total
              </button>
              <button
                onClick={() => setModo("dinheiro")}
                className={`text-sm py-2 rounded-md transition-colors ${
                  modo === "dinheiro" ? "bg-background shadow-sm font-medium" : "text-muted-foreground"
                }`}
              >
                Dinheiro + embutido
              </button>
            </div>
          </div>

          {modo === "percentual" ? (
            <Field
              label="Valor ofertado de lance (% sobre o crédito)"
              hint="inclui o embutido"
            >
              <NumberInput value={percentualLance} onChange={setPercentualLance} step={0.5} />
            </Field>
          ) : (
            <Field
              label="Valor ofertado em dinheiro (R$)"
              hint="somado ao embutido"
            >
              <NumberInput value={dinheiroLance} onChange={setDinheiroLance} />
            </Field>
          )}

          <div>
            <p className="text-sm text-foreground mb-2">Percentual de lance embutido</p>
            <div className="grid grid-cols-2 gap-2">
              {([25, 30] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setEmbutidoPct(p)}
                  className={`py-2 rounded-md text-sm font-medium transition-colors border ${
                    embutidoPct === p
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border text-foreground hover:bg-muted/40"
                  }`}
                >
                  {p}%
                </button>
              ))}
            </div>
          </div>

          {calc.alerta && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 text-destructive text-xs px-3 py-2">
              {calc.alerta}
            </div>
          )}
        </div>

        {/* Results */}
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-1 h-5 bg-primary rounded" />
            <h2 className="font-semibold text-foreground">Resultado da simulação</h2>
          </div>

          <ResultGroup title="Saldo devedor">
            <ResultRow label="Saldo devedor inicial" value={formatBRL(calc.saldoInicial)} />
          </ResultGroup>

          <ResultGroup title="Composição do lance">
            <ResultRow
              label="Lance ofertado total"
              value={`${formatBRL(calc.lanceTotal)} (${calc.lancePct.toFixed(2)}%)`}
            />
            <ResultRow
              label="Parcela embutida (do crédito)"
              value={`${formatBRL(calc.embutidoUsado)} (${embutidoPct.toFixed(2)}% máx.)`}
            />
            <ResultRow
              label="Recursos próprios a desembolsar"
              value={formatBRL(calc.recursosProprios)}
              accent="warning"
            />
          </ResultGroup>

          <ResultGroup title="Pós-contemplação">
            <ResultRow label="Crédito líquido a receber" value={formatBRL(calc.creditoLiquido)} accent="success" />
            <ResultRow label="Saldo devedor restante" value={formatBRL(calc.saldoRestante)} accent="primary" />
            <ResultRow label="Nova parcela estimada" value={formatBRL(calc.novaParcela)} accent="primary" />
          </ResultGroup>

          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Observações:</strong> O percentual ofertado é calculado sobre o crédito.
            Quando o ofertado é maior que o embutido, a diferença é paga com recursos próprios. A nova parcela é uma
            estimativa simples (saldo restante ÷ prazo restante) — o valor real depende do reajuste e regras de cada
            administradora.
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm text-foreground flex items-baseline gap-2 mb-1">
        <span>{label}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  step = 1,
}: {
  value: number;
  onChange: (n: number) => void;
  step?: number;
}) {
  return (
    <input
      type="number"
      step={step}
      value={Number.isFinite(value) ? value : 0}
      onChange={(e) => onChange(parseFloat(e.target.value || "0"))}
      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
    />
  );
}

function ResultGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function ResultRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "success" | "warning" | "primary";
}) {
  const accentClass =
    accent === "success"
      ? "border-l-4 border-emerald-500 bg-emerald-500/5"
      : accent === "warning"
      ? "border-l-4 border-amber-500 bg-amber-500/5"
      : accent === "primary"
      ? "border-l-4 border-primary bg-primary/5"
      : "border border-border";
  return (
    <div className={`flex items-center justify-between rounded-md px-3 py-2 ${accentClass}`}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}