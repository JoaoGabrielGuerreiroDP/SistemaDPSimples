import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

const EMBED_URL = "https://dp-cs-one.vercel.app/";

export default function DPCs() {
  return (
    <div className="flex flex-col h-[calc(100vh-2.75rem)] w-full">
      <div className="flex items-center justify-between border-b border-border/50 bg-background/80 px-4 py-2">
        <h1 className="text-sm font-semibold tracking-wide">CS</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open(EMBED_URL, "_blank", "noopener,noreferrer")}
        >
          <ExternalLink className="w-4 h-4" />
          Abrir em nova aba
        </Button>
      </div>
      <iframe
        src={EMBED_URL}
        title="CS"
        className="flex-1 w-full border-0 bg-background"
        loading="lazy"
        allow="clipboard-read; clipboard-write; fullscreen"
      />
    </div>
  );
}
