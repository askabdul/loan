$body = @{
    pin = "1234"
} | ConvertTo-Json

# Test string validation
Write-Host "Testing PIN validation with isString()..."
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/test-pin-string" -Method Post -ContentType "application/json" -Body $body
    Write-Host "Success:" $response.message
} catch {
    Write-Host "Error:" $_.Exception.Message
}

# Test numeric validation
Write-Host "\nTesting PIN validation with isNumeric()..."
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/test-pin-numeric" -Method Post -ContentType "application/json" -Body $body
    Write-Host "Success:" $response.message
} catch {
    Write-Host "Error:" $_.Exception.Message
}