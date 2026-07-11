$headers = @{"Content-Type"="application/json"}
$content = "# 第一集`n`n## Scene 01 - 茶信馆门口 - 白天`n林逸推门走出。`n> 苏婉儿（冷笑）：终于舍得出来了？`n林逸不答，向街道深处走去。`n> 林逸（OS）：该结束了。`n`n## Scene 02 - 暗巷 - 夜晚`n林逸持剑而立。"
$json = @{
  content = $content
  format = "txt"
  useLocal = $true
} | ConvertTo-Json -Depth 5
try {
  $r = Invoke-WebRequest -Uri "http://localhost:3000/api/ai/script-analyze" -Method POST -Headers $headers -Body $json -UseBasicParsing -TimeoutSec 30
  Write-Host "STATUS: $($r.StatusCode)"
  Write-Host "BODY:"
  Write-Host $r.Content
} catch {
  Write-Host "ERR: $($_.Exception.Message)"
  if ($_.Exception.Response) { $stream = $_.Exception.Response.GetResponseStream(); $reader = New-Object System.IO.StreamReader($stream); Write-Host "BODY: $($reader.ReadToEnd())" }
}
