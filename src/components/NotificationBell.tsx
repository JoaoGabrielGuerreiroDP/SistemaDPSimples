import { useState } from "react";
import { Bell, Check, CheckCheck, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications, type AppNotification } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

const typeIcons: Record<string, string> = {
  kr_assigned: "📋",
  kr_overdue: "🚨",
  kr_near_deadline: "⏰",
  daily_summary: "📊",
  kr_done: "✅",
  gescon_goal_hit: "🎯",
  gescon_inactive: "⚠️",
  account_approval_request: "👤",
  account_approved: "✅",
  info: "ℹ️",
};

function NotificationItem({
  notification,
  onRead,
  onDelete,
}: {
  notification: AppNotification;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const icon = typeIcons[notification.type] || "🔔";
  const navigate = useNavigate();
  const isApproval = notification.type === "account_approval_request";
  const handleClick = () => {
    if (isApproval) {
      onRead(notification.id);
      navigate("/admin/aprovacoes");
    }
  };
  return (
    <div
      onClick={handleClick}
      className={`flex items-start gap-3 p-3 border-b border-border/50 last:border-0 transition-colors ${isApproval ? "cursor-pointer hover:bg-muted/40" : ""} ${
        notification.read ? "opacity-60" : "bg-primary/5"
      }`}
    >
      <span className="text-lg mt-0.5 shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground leading-tight">
          {notification.title}
        </p>
        {notification.message && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {notification.message}
          </p>
        )}
        <p className="text-[10px] text-muted-foreground/70 mt-1">
          {formatDistanceToNow(new Date(notification.created_at), {
            addSuffix: true,
            locale: ptBR,
          })}
        </p>
      </div>
      <div className="flex gap-0.5 shrink-0">
        {!notification.read && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onRead(notification.id)}
            title="Marcar como lida"
          >
            <Check className="w-3 h-3" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-destructive"
          onClick={() => onDelete(notification.id)}
          title="Remover"
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

export function NotificationBell() {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
  } = useNotifications();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0"
        align="end"
        sideOffset={8}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">
            Notificações
          </h3>
          <div className="flex gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={markAllAsRead}
              >
                <CheckCheck className="w-3 h-3 mr-1" />
                Ler todas
              </Button>
            )}
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground"
                onClick={clearAll}
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Limpar
              </Button>
            )}
          </div>
        </div>

        <ScrollArea className="max-h-[400px]">
          {notifications.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              🔔 Nenhuma notificação
            </div>
          ) : (
            notifications.map((n) => (
              <NotificationItem
                key={n.id}
                notification={n}
                onRead={markAsRead}
                onDelete={deleteNotification}
              />
            ))
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
