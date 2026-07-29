"use client";

import { FileCode2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TargetListPage } from "@/components/governance";

export default function PromptTemplatesPage() {
  return <TargetListPage title="Prompt 中心" description="管理草稿、不可变发布版本、变量 Schema、兼容能力和安全规则" endpoint="/api/v1/prompt-templates" emptyText="暂无 Prompt 模板。新模板必须先校验变量、输出 Schema 与敏感字段。" actions={<Button size="sm"><FileCode2 className="mr-1 h-4 w-4" />新建模板</Button>} />;
}

