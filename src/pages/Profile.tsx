import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Camera, Loader2, Save } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function Profile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadProfile();
  }, [user]);

  async function loadProfile() {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("user_id", user!.id)
      .maybeSingle();

    if (data) {
      setDisplayName(data.display_name || "");
      setAvatarUrl((data as any).avatar_url || null);
    } else {
      setDisplayName(user!.user_metadata?.full_name || user!.user_metadata?.display_name || "");
      setAvatarUrl(user!.user_metadata?.avatar_url || null);
    }
    setLoading(false);
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 2MB");
      return;
    }

    setUploading(true);
    const ext = file.name.split(".").pop();
    const filePath = `${user.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast.error("Erro ao enviar foto: " + uploadError.message);
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from("avatars")
      .getPublicUrl(filePath);

    // Add cache buster
    const url = `${publicUrl}?t=${Date.now()}`;
    setAvatarUrl(url);
    setUploading(false);
    toast.success("Foto atualizada!");
  }

  async function handleSave() {
    if (!user) return;
    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .upsert({
        user_id: user.id,
        display_name: displayName.trim(),
        avatar_url: avatarUrl,
      } as any, { onConflict: "user_id" });

    if (error) {
      toast.error("Erro ao salvar: " + error.message);
    } else {
      // Also update auth user metadata
      await supabase.auth.updateUser({
        data: {
          display_name: displayName.trim(),
          full_name: displayName.trim(),
          avatar_url: avatarUrl,
        },
      });
      toast.success("Perfil salvo com sucesso!");
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto px-4 py-8 sm:py-12 space-y-6">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-xl font-bold text-foreground">Meu Perfil</h1>
        </div>

        <div className="glass-card border border-border/50 p-6 space-y-6">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative group">
              <Avatar className="h-24 w-24">
                <AvatarImage src={avatarUrl || undefined} alt={displayName} />
                <AvatarFallback className="bg-primary/20 text-primary text-2xl font-medium">
                  {(displayName || "?").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                {uploading ? (
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                ) : (
                  <Camera className="w-6 h-6 text-white" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </div>
            <p className="text-xs text-muted-foreground">Clique na foto para alterar</p>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Nome</label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Seu nome"
              className="bg-muted/50"
            />
          </div>

          {/* Email (read-only) */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">E-mail</label>
            <Input
              value={user?.email || ""}
              disabled
              className="bg-muted/30 text-muted-foreground"
            />
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin mr-1" />
            ) : (
              <Save className="w-4 h-4 mr-1" />
            )}
            Salvar
          </Button>
        </div>
      </div>
    </div>
  );
}
