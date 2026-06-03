import annualChampion from "@/assets/achievements/annual-champion.png";
import viceChampion from "@/assets/achievements/vice-champion.png";
import monthChampion from "@/assets/achievements/month-champion.png";
import recordBreaker from "@/assets/achievements/record-breaker.png";
import millionClub from "@/assets/achievements/million-club.png";
import goalStreak from "@/assets/achievements/goal-streak.png";
import hatTrick from "@/assets/achievements/hat-trick.png";
import teamChampion from "@/assets/achievements/team-champion.png";
import starStudent from "@/assets/achievements/star-student.png";
import perfectYear from "@/assets/achievements/perfect-year.png";
import firstMillion from "@/assets/achievements/first-million.png";
import fastMillion from "@/assets/achievements/fast-million.png";

const ACHIEVEMENTS = [
  { name: "Campeão Anual", desc: "Top 1 do ano", img: annualChampion },
  { name: "Vice-campeão Anual", desc: "Top 2 do ano", img: viceChampion },
  { name: "Campeão do Mês", desc: "Foi #1 no mês", img: monthChampion },
  { name: "Quebrou Recorde", desc: "Superou o próprio melhor mês", img: recordBreaker },
  { name: "Million Club", desc: "Mês acima de R$ 1M", img: millionClub },
  { name: "Primeiro Milhão", desc: "R$ 1M acumulado em vendas", img: firstMillion },
  { name: "1M em 90 dias", desc: "Atingiu R$ 1M em até 90 dias", img: fastMillion },
  { name: "Sequência de Metas", desc: "Bateu meta vários meses seguidos", img: goalStreak },
  { name: "Hat-Trick", desc: "3 meses seguidos batendo meta", img: hatTrick },
  { name: "Time Campeão", desc: "Fez parte do time #1", img: teamChampion },
  { name: "Aluno Estrela", desc: "Média 5★ nos quizzes", img: starStudent },
  { name: "Ano Perfeito", desc: "Bateu meta todos os meses do ano", img: perfectYear },
];

export default function AchievementsPreview() {
  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="font-display text-2xl sm:text-4xl font-bold text-foreground tracking-tight">
            Preview — Ícones de Conquistas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            10 conquistas que poderemos exibir no Hall dos Recordes e perfil dos vendedores.
          </p>
        </div>

        {/* Tamanho real (como apareceriam no card) */}
        <section className="space-y-2">
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            Tamanho real (32px) — como apareceriam no card
          </h2>
          <div className="rounded-lg border border-border/40 bg-card p-4 flex flex-wrap gap-2">
            {ACHIEVEMENTS.map((a) => (
              <img
                key={a.name}
                src={a.img}
                alt={a.name}
                title={a.name}
                width={32}
                height={32}
                loading="lazy"
                className="w-8 h-8 object-contain"
              />
            ))}
          </div>
        </section>

        {/* Médio */}
        <section className="space-y-2">
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            Tamanho médio (64px)
          </h2>
          <div className="rounded-lg border border-border/40 bg-card p-4 flex flex-wrap gap-3">
            {ACHIEVEMENTS.map((a) => (
              <img
                key={a.name}
                src={a.img}
                alt={a.name}
                title={a.name}
                width={64}
                height={64}
                loading="lazy"
                className="w-16 h-16 object-contain"
              />
            ))}
          </div>
        </section>

        {/* Grid grande com nome */}
        <section className="space-y-2">
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            Detalhe (com nome e descrição)
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {ACHIEVEMENTS.map((a) => (
              <div
                key={a.name}
                className="rounded-lg border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-orange-500/5 p-3 flex flex-col items-center text-center gap-2"
              >
                <img
                  src={a.img}
                  alt={a.name}
                  width={128}
                  height={128}
                  loading="lazy"
                  className="w-24 h-24 object-contain drop-shadow-lg"
                />
                <p className="text-sm font-bold text-foreground leading-tight">{a.name}</p>
                <p className="text-[11px] text-muted-foreground leading-snug">{a.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
