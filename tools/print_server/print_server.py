import threading
import traceback
from flask import Flask, request, jsonify
from flask_cors import CORS
import win32print

app = Flask(__name__)
CORS(app)  # Allow browser to call localhost

PRINTER_NAME = "Generic / Text Only"

# Lock to ensure only one print job is processed at a time
print_lock = threading.Lock()

def send_to_printer(text_data):
    """Sends raw text to the Windows printer using win32print."""
    try:
        hPrinter = win32print.OpenPrinter(PRINTER_NAME)
    except Exception as e:
        print(f"Failed to open printer '{PRINTER_NAME}': {e}")
        raise Exception(f"Printer '{PRINTER_NAME}' not found or inaccessible.")

    try:
        win32print.StartDocPrinter(hPrinter, 1, ("MessFloww KOT", None, "RAW"))
        win32print.StartPagePrinter(hPrinter)
        
        # Write bytes
        # Windows generally expects ANSI/CP1252 for raw text printers, but UTF-8 is often fine if the printer supports it.
        # We will encode as ascii with ignore to be safe for a generic text printer.
        win32print.WritePrinter(hPrinter, text_data.encode("ascii", "ignore"))
        
        win32print.EndPagePrinter(hPrinter)
        win32print.EndDocPrinter(hPrinter)
    finally:
        win32print.ClosePrinter(hPrinter)

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint to verify server and printer status."""
    try:
        # Check if printer can be opened
        hPrinter = win32print.OpenPrinter(PRINTER_NAME)
        win32print.ClosePrinter(hPrinter)
        return jsonify({"status": "ok", "printer": PRINTER_NAME})
    except Exception as e:
        return jsonify({"status": "error", "error": str(e), "printer": PRINTER_NAME}), 500

@app.route('/print-kot', methods=['POST'])
def print_kot():
    data = request.json
    if not data:
        return jsonify({"success": False, "error": "No data provided"}), 400

    order_number = data.get("orderNumber", "N/A")
    user_roll_no = data.get("userRollNo", "Unknown")
    slot_name = data.get("slotName", "")
    items = data.get("items", [])

    # Format the receipt text
    receipt_lines = []
    receipt_lines.append(f"KOT #{order_number}".center(32))
    receipt_lines.append("")
    receipt_lines.append(f"Student: {user_roll_no}")
    if slot_name:
        receipt_lines.append(f"Slot: {slot_name}")
    receipt_lines.append("-" * 32)
    
    for item in items:
        qty = item.get("qty", 1)
        name = item.get("name", "Unknown Item")
        receipt_lines.append(f"{qty}x {name}")
    
    receipt_lines.append("-" * 32)
    receipt_lines.append("")
    receipt_lines.append("")
    receipt_lines.append("")
    receipt_lines.append("") # Extra lines to feed paper for tearing
    receipt_lines.append("\x1d\x56\x00") # ESC/POS partial cut command (if printer supports it, harmless if not)
    receipt_lines.append("")

    receipt_text = "\n".join(receipt_lines)

    # Use the lock to ensure jobs are sent sequentially
    acquired = print_lock.acquire(timeout=10.0) # Wait up to 10 seconds for the lock
    if not acquired:
         return jsonify({"success": False, "error": "Print queue is busy. Try again."}), 503
         
    try:
        print(f"Printing KOT #{order_number}...")
        send_to_printer(receipt_text)
        return jsonify({"success": True})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        print_lock.release()

if __name__ == '__main__':
    print(f"Starting MessFloww Print Server on port 5000...")
    print(f"Target Printer: '{PRINTER_NAME}'")
    # Run server on all interfaces so localhost works
    app.run(host='0.0.0.0', port=5000, debug=False)
