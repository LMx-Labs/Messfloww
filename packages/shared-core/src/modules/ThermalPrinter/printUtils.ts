import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { ThermalReceipt } from './ThermalReceipt';
import { BillDocument, ReceiptSettings } from './types';

// Global queue to ensure sequential printing
let printQueue = Promise.resolve();

/**
 * Utility to trigger a thermal receipt print using a hidden iframe.
 * This ensures that the print layout is isolated from the main UI.
 */
export const printReceipt = (data: BillDocument | BillDocument[], settings?: ReceiptSettings) => {
  // Create a hidden iframe
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
  if (!iframeDoc) {
    console.error('Could not create iframe for printing');
    return;
  }

  const itemsArray = Array.isArray(data) ? data : [data];

  // Render the components resolving them to strings, joined by page breaks
  const receiptHtml = itemsArray.map(doc => ReactDOMServer.renderToString(
    React.createElement(ThermalReceipt, { data: doc, settings })
  )).join('<div class="page-break" style="page-break-after: always; display: block; height: 1px;"></div>');

  // Get current styles to inject into iframe
  // This helps if the ThermalReceipt.css is bundled into the main styles
  // Alternatively, we can manually define the thermal styles here for robustness
  const styles = Array.from(document.styleSheets)
    .filter(sheet => {
        try {
            return !sheet.href || sheet.href.startsWith(window.location.origin);
        } catch (e) {
            return false;
        }
    })
    .map(sheet => {
      try {
        return Array.from(sheet.cssRules).map(rule => rule.cssText).join('');
      } catch (e) {
        return '';
      }
    })
    .join('\n');

  // Construct the full HTML for the iframe
  const fullHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Print Receipt</title>
        <style>
          ${styles}
          @media print {
            @page { size: 80mm auto; margin: 0; }
            body { 
              margin: 0; padding: 0; width: 80mm;
              font-family: 'Courier New', monospace;
              font-size: 11px; line-height: 1.4; color: #000; background: #fff;
            }
            .thermal-receipt-wrapper { display: block !important; visibility: visible !important; }
            .receipt-header { text-align: center; font-weight: bold; font-size: 13px; }
            .receipt-row { display: flex; justify-content: space-between; }
            .receipt-divider { border-top: 1px dashed #000; margin: 4px 0; }
            .receipt-total { font-weight: bold; font-size: 14px; border-top: 2px solid #000; padding-top: 4px; }
            .kot-header { text-align: center; font-size: 16px; font-weight: bold; text-transform: uppercase; }
          }
        </style>
      </head>
      <body>
        ${receiptHtml}
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() {
              window.frameElement.remove();
            }, 100);
          };
        </script>
      </body>
    </html>
  `;

  iframeDoc.open();
  iframeDoc.write(fullHtml);
  iframeDoc.close();
};

/**
 * Attempts to print silently via the local Python print server.
 * Falls back to the iframe method if the server is unavailable.
 * Uses a sequential queue to prevent overlapping jobs.
 */
export const printReceiptSilent = (data: BillDocument | BillDocument[], settings?: ReceiptSettings): Promise<void> => {
  const executePrint = async () => {
    try {
      const itemsArray = Array.isArray(data) ? data : [data];
      
      // Try local Python print server first
      const response = await fetch('http://localhost:5000/print-kot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Send the first document. In a real system, we might loop or the server might handle arrays.
        // Based on the python script we wrote, it expects a single order JSON object.
        body: JSON.stringify(itemsArray[0]) 
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }
      
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Print server failed to print');
      }
      
      console.log('Successfully printed via local server');
    } catch (error) {
      console.warn('Silent print failed, falling back to iframe dialog:', error);
      // Fallback to iframe method
      printReceipt(data, settings);
      
      // Add a small delay for the fallback to process before the next job
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  // Add to sequential queue
  printQueue = printQueue.then(executePrint).catch(executePrint);
  return printQueue;
};
