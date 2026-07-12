/**
 * CSV 导出工具（用户下载用，与业务存储无关）。
 *
 * 评审 P2-C2 之后，业务数据全部走 SQLite（node:sqlite）。
 * 但用户仍需要把分镜表 / 剪辑清单导出为 CSV 用 Excel 打开，
 * 这是**业务功能的输出格式**，不是存储后端。
 *
 * 因此这里独立保留一份纯函数式 CSV 编码工具，
 * 既不依赖 csv-parse/csv-stringify，也和存储层解耦。
 */

/** 用 RFC 4180 规则编码一个 CSV 单元格：包含引号 / 换行 / 逗号时整体加引号并把内部 " 替换为 ""。 */
export function encodeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** 编码一行为 CSV（数组→字符串）。 */
export function encodeCsvRow(cells: unknown[]): string {
  return cells.map(encodeCsvCell).join(",");
}

/** 编码表头+多行数据为完整 CSV（带 BOM 头以便 Excel 识别 UTF-8）。 */
export function encodeCsv(header: string[], rows: unknown[][]): string {
  const lines = [encodeCsvRow(header), ...rows.map(encodeCsvRow)];
  // \uFEFF 让 Excel 自动识别 UTF-8（避免中文乱码）
  return `\uFEFF${lines.join("\r\n")}`;
}
