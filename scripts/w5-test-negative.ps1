$ErrorActionPreference = "Continue"
$tests = @(
    @{ Name = "pause-skipped"; Method = "POST"; Url = "http://127.0.0.1:3000/api/pipeline/runs/run-test-1784639536487/nodes/node-test-1784639536487/pause" },
    @{ Name = "missing-run"; Method = "POST"; Url = "http://127.0.0.1:3000/api/pipeline/runs/nonexistent/nodes/nope/pause" },
    @{ Name = "invalid-action"; Method = "POST"; Url = "http://127.0.0.1:3000/api/pipeline/runs/run-test-1784639536487/nodes/node-test-1784639536487/foo" },
    @{ Name = "node-not-in-run"; Method = "POST"; Url = "http://127.0.0.1:3000/api/pipeline/runs/run-test-1784639536487/nodes/wrong-node/pause" }
)
foreach ($t in $tests) {
    Write-Host "=== $($t.Name) ==="
    try {
        $r = Invoke-WebRequest -Uri $t.Url -Method $t.Method -UseBasicParsing
        Write-Host "  status=$($r.StatusCode)"
        Write-Host "  body=$($r.Content)"
    } catch {
        Write-Host "  status=$($_.Exception.Response.StatusCode.value__)"
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Host "  body=$($reader.ReadToEnd())"
    }
}
