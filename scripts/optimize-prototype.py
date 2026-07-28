import re

path = 'ux-report/prototypes/production-ui-prototype.html'
with open(path, 'r', encoding='utf-8') as f:
    html = f.read()

changes = []

# ========== CSS 精确替换 ==========
css_replacements = [
    # 8px 网格对齐
    ('--sidebar-w: 220px;', '--sidebar-w: 224px;'),
    ('  padding: 0 20px;\n  gap: 16px;\n  flex-shrink: 0;\n}', '  padding: 0 24px;\n  gap: 16px;\n  flex-shrink: 0;\n}'),
    ('.content {\n  flex: 1;\n  overflow-y: auto;\n  padding: 20px;\n}', '.content {\n  flex: 1;\n  overflow-y: auto;\n  padding: 24px;\n}'),
    ('.sidebar-brand {\n  padding: 14px 16px;\n  border-bottom: 1px solid var(--border);\n}', '.sidebar-brand {\n  padding: 16px;\n  border-bottom: 1px solid var(--border);\n}'),
    ('  letter-spacing: 0.8px;\n  padding: 6px 16px;\n  font-weight: 500;', '  letter-spacing: 0.8px;\n  padding: 8px 16px;\n  font-weight: 500;'),
    ('  padding: 7px 16px;\n  color: var(--text-secondary);\n  cursor: pointer;\n  font-size: 13px;\n  border-left: 2px solid transparent;', '  padding: 8px 16px;\n  color: var(--text-secondary);\n  cursor: pointer;\n  font-size: 13px;\n  border-left: 2px solid transparent;'),
    ('.stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }', '.stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }'),
    ('.stat-card {\n  background: var(--bg-card);\n  border: 1px solid var(--border);\n  border-radius: var(--radius-md);\n  padding: 14px 16px;\n}', '.stat-card {\n  background: var(--bg-card);\n  border: 1px solid var(--border);\n  border-radius: var(--radius-md);\n  padding: 16px;\n}'),
    ('.grid { display: grid; gap: 12px; }', '.grid { display: grid; gap: 16px; }'),
    ('.toolbar {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  margin-bottom: 12px;\n  flex-wrap: wrap;\n}', '.toolbar {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  margin-bottom: 16px;\n  flex-wrap: wrap;\n}'),
    ('.asset-info { padding: 10px 12px; }', '.asset-info { padding: 12px; }'),
    # 装饰渐变 -> 中性灰
    ('.asset-thumb {\n  width: 100%;\n  aspect-ratio: 3/4;\n  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  position: relative;\n  overflow: hidden;\n}', '.asset-thumb {\n  width: 100%;\n  aspect-ratio: 3/4;\n  background: var(--bg-elevated);\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  position: relative;\n  overflow: hidden;\n}'),
    ('.chat-attachment {\n  width: 80px; height: 80px;\n  border-radius: var(--radius-sm);\n  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);\n  overflow: hidden;\n}', '.chat-attachment {\n  width: 80px; height: 80px;\n  border-radius: var(--radius-sm);\n  background: var(--bg-elevated);\n  overflow: hidden;\n}'),
    ('.image-cell {\n  aspect-ratio: 9/16;\n  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);\n  border-radius: var(--radius-sm);\n  overflow: hidden;\n  position: relative;\n  cursor: pointer;\n}', '.image-cell {\n  aspect-ratio: 9/16;\n  background: var(--bg-elevated);\n  border-radius: var(--radius-sm);\n  overflow: hidden;\n  position: relative;\n  cursor: pointer;\n}'),
    # 时间线片段 -> 中性 + 左边框区分
    ('.timeline-clip.video { background: linear-gradient(135deg, #1a4a3a, #10b981); }', '.timeline-clip.video { background: var(--bg-elevated); border-left: 3px solid var(--accent); color: var(--text-secondary); }'),
    ('.timeline-clip.audio { background: linear-gradient(135deg, #1a2a4a, #3b82f6); }', '.timeline-clip.audio { background: var(--bg-elevated); border-left: 3px solid var(--text-muted); color: var(--text-secondary); }'),
    ('.timeline-clip.subtitle { background: linear-gradient(135deg, #4a2a1a, #f59e0b); }', '.timeline-clip.subtitle { background: var(--bg-elevated); border-left: 3px solid var(--text-dim); color: var(--text-secondary); }'),
    # 流水线运行中 -> 强调色描边（单强调色）
    ('.pipeline-stage.running .dot { background: var(--info); color: #fff; }', '.pipeline-stage.running .dot { background: transparent; color: var(--accent); border: 2px solid var(--accent); }'),
    ('.pipeline-stage.running .name { color: var(--info); }', '.pipeline-stage.running .name { color: var(--accent); }'),
    # 模型评分星 -> 中性
    ('.model-card .stars { font-size: 11px; color: var(--warning); margin-top: 4px; }', '.model-card .stars { font-size: 11px; color: var(--text-muted); margin-top: 4px; }'),
]

for old, new in css_replacements:
    if old in html:
        html = html.replace(old, new, 1)
        changes.append('OK: ' + old.strip().split('\n')[0][:45])
    else:
        changes.append('MISS: ' + old.strip().split('\n')[0][:45])

# ========== 内联样式：仅处理 <body> 部分，不动 CSS ==========
idx = html.index('<body>')
head = html[:idx]
body = html[idx:]

# 1. 内联装饰渐变 -> 中性灰
n1 = len(re.findall(r'background:linear-gradient\([^)]*\)', body))
body = re.sub(r'background:linear-gradient\([^)]*\)', 'background:var(--bg-elevated)', body)
n2 = len(re.findall(r'background: linear-gradient\([^)]*\)', body))
body = re.sub(r'background: linear-gradient\([^)]*\)', 'background:var(--bg-elevated)', body)
changes.append('Inline gradients -> neutral: ' + str(n1+n2))

# 2. 统计数值多色 -> 中性（靠字号字重分层级）
n3 = len(re.findall(r'<div class="value" style="color:var\(--(info|accent|error|warning)\)">', body))
body = re.sub(r'<div class="value" style="color:var\(--(info|accent|error|warning)\)">', '<div class="value">', body)
changes.append('Stat value colors -> neutral: ' + str(n3))

# 3. 进度条 info 蓝 -> 强调色（单强调色）
n5 = len(re.findall(r';background:var\(--info\)', body))
body = re.sub(r';background:var\(--info\)', '', body)
changes.append('Progress info -> accent: ' + str(n5))

html = head + body

with open(path, 'w', encoding='utf-8') as f:
    f.write(html)

print('=== CHANGES ===')
for c in changes:
    print(c)
print('=== DONE ===')
