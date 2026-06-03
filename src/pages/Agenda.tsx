import { useState, useMemo } from "react";
import { Calendar, ChevronLeft, ChevronRight, Clock, MapPin, User, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCalendarEvents, CalendarEvent } from "@/hooks/useCalendarEvents";
import { cn } from "@/lib/utils";

type ViewMode = "week" | "day";

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekEnd(date: Date): Date {
  const d = getWeekStart(date);
  d.setDate(d.getDate() + 7);
  return d;
}

function getDayStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getDayEnd(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

const HOURS = Array.from({ length: 16 }, (_, i) => i + 7); // 7h to 22h

const USER_COLORS = [
  "bg-blue-500/20 border-blue-500/50 text-blue-200",
  "bg-emerald-500/20 border-emerald-500/50 text-emerald-200",
  "bg-amber-500/20 border-amber-500/50 text-amber-200",
  "bg-purple-500/20 border-purple-500/50 text-purple-200",
  "bg-rose-500/20 border-rose-500/50 text-rose-200",
  "bg-cyan-500/20 border-cyan-500/50 text-cyan-200",
  "bg-orange-500/20 border-orange-500/50 text-orange-200",
  "bg-pink-500/20 border-pink-500/50 text-pink-200",
  "bg-teal-500/20 border-teal-500/50 text-teal-200",
  "bg-indigo-500/20 border-indigo-500/50 text-indigo-200",
];

function formatTime(dateStr: string): string {
  if (!dateStr || dateStr.length <= 10) return "Dia inteiro";
  return new Date(dateStr).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatDateShort(date: Date): string {
  return date.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
}

function formatDateFull(date: Date): string {
  return date.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
}

function EventCard({ event, colorClass, compact }: { event: CalendarEvent; colorClass: string; compact?: boolean }) {
  return (
    <a
      href={event.htmlLink}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "block border rounded-md p-2 mb-1 hover:opacity-80 transition-opacity cursor-pointer",
        colorClass,
        compact ? "text-[10px]" : "text-xs"
      )}
    >
      <p className="font-medium truncate">{event.summary}</p>
      <div className="flex items-center gap-1 mt-0.5 opacity-80">
        <Clock className="h-3 w-3 shrink-0" />
        <span>{formatTime(event.start)} - {formatTime(event.end)}</span>
      </div>
      {!compact && (
        <div className="flex items-center gap-1 mt-0.5 opacity-80">
          <User className="h-3 w-3 shrink-0" />
          <span className="truncate">{event.userName}</span>
        </div>
      )}
      {!compact && event.location && (
        <div className="flex items-center gap-1 mt-0.5 opacity-70">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">{event.location}</span>
        </div>
      )}
    </a>
  );
}

function WeekView({
  events,
  currentDate,
  userColorMap,
}: {
  events: CalendarEvent[];
  currentDate: Date;
  userColorMap: Map<string, string>;
}) {
  const weekStart = getWeekStart(currentDate);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const day of days) {
      const key = day.toISOString().slice(0, 10);
      map.set(key, []);
    }
    for (const ev of events) {
      const key = new Date(ev.start).toISOString().slice(0, 10);
      if (map.has(key)) {
        map.get(key)!.push(ev);
      }
    }
    return map;
  }, [events, days]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="grid grid-cols-7 gap-1">
      {days.map((day) => {
        const key = day.toISOString().slice(0, 10);
        const dayEvents = eventsByDay.get(key) || [];
        const isToday = key === today;

        return (
          <div key={key} className="min-h-[200px]">
            <div
              className={cn(
                "text-center py-1.5 rounded-t-md text-xs font-medium",
                isToday ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground"
              )}
            >
              {formatDateShort(day)}
            </div>
            <div className="border border-t-0 border-border/50 rounded-b-md p-1 space-y-0.5 min-h-[180px]">
              {dayEvents.length === 0 && (
                <p className="text-[10px] text-muted-foreground text-center pt-4">—</p>
              )}
              {dayEvents.map((ev) => (
                <EventCard key={ev.id} event={ev} colorClass={userColorMap.get(ev.userEmail) || USER_COLORS[0]} compact />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DayView({
  events,
  currentDate,
  userColorMap,
}: {
  events: CalendarEvent[];
  currentDate: Date;
  userColorMap: Map<string, string>;
}) {
  const dayKey = currentDate.toISOString().slice(0, 10);
  const dayEvents = events.filter((ev) => new Date(ev.start).toISOString().slice(0, 10) === dayKey);

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-muted-foreground">{formatDateFull(currentDate)}</h3>
      {dayEvents.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground text-sm">
            Nenhum evento neste dia
          </CardContent>
        </Card>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {dayEvents.map((ev) => (
          <EventCard key={ev.id} event={ev} colorClass={userColorMap.get(ev.userEmail) || USER_COLORS[0]} />
        ))}
      </div>
    </div>
  );
}

export default function Agenda() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [filterUser, setFilterUser] = useState("all");

  const rangeStart = viewMode === "week" ? getWeekStart(currentDate) : getDayStart(currentDate);
  const rangeEnd = viewMode === "week" ? getWeekEnd(currentDate) : getDayEnd(currentDate);

  const { data: events = [], isLoading, refetch, isFetching } = useCalendarEvents(rangeStart, rangeEnd);

  const users = useMemo(() => {
    const map = new Map<string, string>();
    for (const ev of events) {
      if (!map.has(ev.userEmail)) map.set(ev.userEmail, ev.userName);
    }
    return Array.from(map.entries()).map(([email, name]) => ({ email, name }));
  }, [events]);

  const userColorMap = useMemo(() => {
    const m = new Map<string, string>();
    users.forEach((u, i) => m.set(u.email, USER_COLORS[i % USER_COLORS.length]));
    return m;
  }, [users]);

  const filteredEvents = useMemo(
    () => (filterUser === "all" ? events : events.filter((ev) => ev.userEmail === filterUser)),
    [events, filterUser]
  );

  const navigate = (dir: -1 | 1) => {
    const d = new Date(currentDate);
    if (viewMode === "week") d.setDate(d.getDate() + dir * 7);
    else d.setDate(d.getDate() + dir);
    setCurrentDate(d);
  };

  const goToday = () => setCurrentDate(new Date());

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">Agenda — DP Consórcios</h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={goToday}>
            Hoje
          </Button>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Select value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <SelectTrigger className="w-[110px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Semana</SelectItem>
              <SelectItem value="day">Dia</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterUser} onValueChange={setFilterUser}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue placeholder="Filtrar por pessoa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.email} value={u.email}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Legend */}
      {users.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {users.map((u) => (
            <Badge
              key={u.email}
              variant="outline"
              className={cn("text-[10px] cursor-pointer", userColorMap.get(u.email))}
              onClick={() => setFilterUser(filterUser === u.email ? "all" : u.email)}
            >
              {u.name}
            </Badge>
          ))}
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">Carregando agenda...</span>
        </div>
      ) : (
        <>
          {viewMode === "week" && (
            <WeekView events={filteredEvents} currentDate={currentDate} userColorMap={userColorMap} />
          )}
          {viewMode === "day" && (
            <DayView events={filteredEvents} currentDate={currentDate} userColorMap={userColorMap} />
          )}
        </>
      )}

      {/* Summary */}
      {!isLoading && (
        <p className="text-[10px] text-muted-foreground text-right">
          {filteredEvents.length} evento(s) • {users.length} usuário(s) carregado(s)
        </p>
      )}
    </div>
  );
}
