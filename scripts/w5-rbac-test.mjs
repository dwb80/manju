// 单元测试 ensureNodePermission 逻辑
// 直接调用 hasPermission 验证 RBAC 权限矩阵

import { hasPermission } from "../backend/dist/src/services/horizontal/project-member-service.js";

const cases = [
  { role: "owner", perm: "task.update_status", expect: true },
  { role: "editor", perm: "task.update_status", expect: true },
  { role: "reviewer", perm: "task.update_status", expect: false },
  { role: "commenter", perm: "task.update_status", expect: false },
  { role: "viewer", perm: "task.update_status", expect: false },
  { role: "admin", perm: "task.update_status", expect: false },  // admin is not a project member role
];

let pass = 0;
let fail = 0;
for (const c of cases) {
  const got = hasPermission({ role: c.role }, c.perm);
  const ok = got === c.expect;
  if (ok) pass++; else fail++;
  console.log(`role=${c.role} perm=${c.perm} expect=${c.expect} got=${got} ${ok ? "✓" : "✗"}`);
}
console.log(`\nresult: ${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
