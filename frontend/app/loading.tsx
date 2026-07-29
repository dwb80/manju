import { Loader2 } from "lucide-react";

export default function Loading() {
  return <main role="status" aria-live="polite" className="grid min-h-[60vh] place-items-center"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />正在加载页面…</div></main>;
}

