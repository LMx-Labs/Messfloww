# Messfloww
A mess management software

## Running in Silent-Print Kiosk Mode
To enable silent thermal printing (bypassing the print dialog), launch Chrome with the following flags:

```bash
# Windows Kiosk (Counter)
chrome.exe --kiosk --kiosk-printing https://<your-domain>/scan

# Windows Kitchen (KDS)
chrome.exe --kiosk --kiosk-printing https://<your-domain>/kds

# macOS (dev test)
open -a "Google Chrome" --args --kiosk --kiosk-printing http://localhost:5173/scan
```
