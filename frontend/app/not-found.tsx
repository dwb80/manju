import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return <main className="grid min-h-[60vh] place-items-center p-6"><div className="text-center"><p className="text-sm text-muted-foreground">404</p><h1 className="mt-2 text-xl font-semibold">资源不存在或已被删除</h1><p className="mt-2 text-sm text-muted-foreground">请检查链接，或返回项目中心查看恢复与替代入口。</p><Button asChild className="mt-4"><Link href="/projects">返回项目中心</Link></Button></div></main>;
}

