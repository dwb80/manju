@echo off
setlocal

rem ============================================================
rem 强制 UTF-8（Windows + macOS/Linux 通用）
rem ============================================================
rem Windows 默认代码页是 CP936/GBK，Node stdout 直接写中文会被打成 ??
rem 三件事一起做保证各终端都能正确显示：
rem   1) chcp 65001        —— 改 cmd 当前窗口的代码页
rem   2) PYTHONIOENCODING  —— 给可能的子进程用
rem   3) POWERSHELL_OUTPUT_ENCODING=UTF8 —— 让 PowerShell 调用走 UTF-8
rem
rem 在 macOS / Linux 下运行 npm 时，LANG/LC_ALL 已经是 UTF-8，无需 chcp；
rem chcp 在非 Windows 上是无效命令，所以用 `>nul 2>&1` 抑制报错。
chcp 65001 >nul 2>&1

set "POWERSHELL_OUTPUT_ENCODING=UTF8"
set "PYTHONIOENCODING=utf-8"
rem 兼容 LANG 已设的用户；未设时给一个 C.UTF-8，避免 macOS Terminal 默认 zh_CN 不存在
if not defined LANG set "LANG=C.UTF-8"
if not defined LC_ALL set "LC_ALL=C.UTF-8"

set "PORT=3000"
set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"

echo [后端] 正在检查端口 %PORT%...
for /f "usebackq tokens=*" %%p in (`powershell -NoProfile -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; $OutputEncoding = [System.Text.Encoding]::UTF8; Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique"`) do (
  if not "%%p"=="" (
    echo [后端] 端口 %PORT% 被进程 %%p 占用，正在结束...
    taskkill /PID %%p /F >nul 2>n1
  )
)

cd /d "%BACKEND%"
if not exist "data\logs" mkdir "data\logs"
echo [后端] 正在编译 TypeScript...
call npm run build
if errorlevel 1 (
  echo [后端] 编译失败。
  pause
  exit /b 1
)

echo [后端] 启动中，监听 http://localhost:%PORT%
echo [后端] 运行时日志目录：%BACKEND%\data\logs
echo [后端] 当前日志级别：%LOG_LEVEL%   （想看详细日志请 set LOG_LEVEL=debug 后再启动）
call npm start
