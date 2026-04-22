# MessFloww Print Server

A lightweight Python Flask server designed to run locally on the Kiosk PC to enable completely silent printing of KOTs (Kitchen Order Tickets) to a Windows thermal printer.

## Why this exists
Browser-based printing (`window.print()`) opens a print dialog or creates hidden iframes. Under heavy load (10+ scans per minute), hidden iframes can crash the Windows Print Spooler. This Python server bypasses the browser entirely, sending raw text directly to the printer sequentially, ensuring reliability during peak hours.

## Setup Instructions (Windows)

1. **Install Python**
   - Download Python 3 from [python.org](https://www.python.org/downloads/windows/).
   - **IMPORTANT:** During installation, check the box **"Add Python to PATH"**.

2. **Install Dependencies**
   - Open Command Prompt and run:
     ```cmd
     pip install -r requirements.txt
     ```

3. **Configure the Printer**
   - Go to Windows Settings -> Devices -> Printers & scanners.
   - Note the exact name of your thermal printer. 
   - Ensure the name matches `PRINTER_NAME` in `print_server.py`. The default is `"Generic / Text Only"`.
   - If your printer is named differently, update the `PRINTER_NAME` variable in `print_server.py`.

4. **Testing**
   - Run the server:
     ```cmd
     python print_server.py
     ```
   - It should say "Starting MessFloww Print Server on port 5000...".
   - Open a browser and go to `http://localhost:5000/health`. You should see `{"status":"ok", ...}`.

## Auto-Startup on Boot
We want the kiosk PC to automatically start this server and Chrome in Kiosk mode when turned on.
See the `tools/kiosk_launcher` folder for the startup scripts.
