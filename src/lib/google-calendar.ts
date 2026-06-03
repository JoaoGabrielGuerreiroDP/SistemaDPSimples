/**
 * Generates a Google Calendar event URL with pre-filled data.
 * Opens in the user's own Google Calendar.
 */

interface CalendarEvent {
  title: string;
  description?: string;
  startDate: Date;
  endDate?: Date;
  location?: string;
  guests?: string[];
}

export function buildGoogleCalendarUrl(event: CalendarEvent): string {
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  const start = fmt(event.startDate);
  const end = fmt(event.endDate ?? new Date(event.startDate.getTime() + 60 * 60 * 1000));

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${start}/${end}`,
  });

  if (event.description) params.set("details", event.description);
  if (event.location) params.set("location", event.location);
  if (event.guests && event.guests.length > 0) params.set("add", event.guests.join(","));

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function buildPartnerDeadlineUrl(
  partnerName: string,
  prazo: string,
  etapa: string,
  responsavel?: string | null
): string {
  const date = new Date(prazo + "T09:00:00");
  return buildGoogleCalendarUrl({
    title: `📋 Prazo: ${partnerName}`,
    description: [
      `Parceiro: ${partnerName}`,
      `Etapa: ${etapa}`,
      responsavel ? `Responsável: ${responsavel}` : "",
      "",
      "Gerado pelo HUB — DP Consórcios",
    ]
      .filter(Boolean)
      .join("\n"),
    startDate: date,
    endDate: new Date(date.getTime() + 60 * 60 * 1000),
  });
}

export function buildPartnerActionUrl(
  partnerName: string,
  proxAcao: string,
  prazo?: string | null,
  responsavel?: string | null
): string {
  const date = prazo ? new Date(prazo + "T10:00:00") : new Date();
  return buildGoogleCalendarUrl({
    title: `🎯 Ação: ${partnerName}`,
    description: [
      `Parceiro: ${partnerName}`,
      `Próxima ação: ${proxAcao}`,
      responsavel ? `Responsável: ${responsavel}` : "",
      "",
      "Gerado pelo HUB — DP Consórcios",
    ]
      .filter(Boolean)
      .join("\n"),
    startDate: date,
    endDate: new Date(date.getTime() + 60 * 60 * 1000),
  });
}
