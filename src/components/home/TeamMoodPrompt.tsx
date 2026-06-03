import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTeamMood, type Mood } from "@/hooks/useTeamMood";

export function TeamMoodPrompt() {
  const { todayMood, loading, setMood } = useTeamMood();
  if (loading || todayMood) return null;

  const options: { mood: Mood; emoji: string; label: string }[] = [
    { mood: "happy", emoji: "😄", label: "Bem" },
    { mood: "neutral", emoji: "😐", label: "Normal" },
    { mood: "sad", emoji: "😞", label: "Difícil" },
  ];

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardContent className="py-4 flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm font-medium">Como você está hoje?</p>
        <div className="flex gap-2">
          {options.map((o) => (
            <Button key={o.mood} variant="outline" size="sm" onClick={() => setMood(o.mood)} className="gap-2">
              <span className="text-lg">{o.emoji}</span> {o.label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}