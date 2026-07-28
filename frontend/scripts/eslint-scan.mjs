// ESLint 全量扫描脚本：执行并保存结果
import { ESLint } from 'eslint'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')

const dirs = ['components', 'app', 'hooks', 'lib', 'services']

async function walk(dir) {
  const out = []
  async function recur(d) {
    let entries
    try {
      entries = await fs.readdir(d, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name === '.next' || e.name === '.next-build' || e.name === 'dist') continue
      const p = path.join(d, e.name)
      if (e.isDirectory()) await recur(p)
      else if (/\.(ts|tsx)$/.test(e.name)) out.push(p)
    }
  }
  await recur(dir)
  return out
}

const files = []
for (const d of dirs) {
  const arr = await walk(path.join(projectRoot, d))
  files.push(...arr)
}
console.log('files:', files.length)

const eslint = new ESLint({
  cwd: projectRoot,
  overrideConfigFile: path.join(projectRoot, 'eslint.config.mjs'),
})

const results = await eslint.lintFiles(files)
const total = results.reduce((acc, r) => acc + r.errorCount + r.warningCount, 0)
console.log('errors+warns:', total)
const fatal = results.reduce((acc, r) => acc + r.fatalErrorCount, 0)
console.log('fatal:', fatal)

let hasDup = false
const byRule = {}
const parseErrors = []
for (const r of results) {
  if (r.errorCount === 0 && r.warningCount === 0) continue
  for (const m of r.messages) {
    const rule = m.ruleId || '(parse-error)'
    byRule[rule] = (byRule[rule] || 0) + 1
    if (m.ruleId === 'import/no-duplicates') {
      hasDup = true
      console.log('---', r.filePath)
      console.log(`  L${m.line}:C${m.column} ${m.ruleId} ${m.message}`)
    } else if (!m.ruleId) {
      parseErrors.push({ file: r.filePath, line: m.line, col: m.column, msg: m.message })
    }
  }
}
console.log('by rule:', byRule)
if (parseErrors.length) {
  console.log('\n=== parse errors (first 10) ===')
  for (const p of parseErrors.slice(0, 10)) {
    console.log(`  ${p.file}:L${p.line}:C${p.col}  ${p.msg}`)
  }
}

if (!hasDup) {
  console.log('✅ No duplicate imports found in project!')
}
