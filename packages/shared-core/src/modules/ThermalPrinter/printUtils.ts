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
/**
 * Utility to trigger a thermal receipt print using a hidden iframe.
 * This ensures that the print layout is isolated from the main UI.
 * Now promise-based to ensure sequential execution via the global queue.
 */
export const printReceipt = (data: BillDocument | BillDocument[], settings?: ReceiptSettings): Promise<void> => {
  const job = () => new Promise<void>((resolve) => {
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
      resolve();
      return;
    }

    const itemsArray = Array.isArray(data) ? data : [data];

    // Render the components resolving them to strings, joined by page breaks
    const receiptHtml = itemsArray.map(doc => ReactDOMServer.renderToString(
      React.createElement(ThermalReceipt, { data: doc, settings })
    )).join('<div class="page-break" style="page-break-after: always; display: block; height: 1px;"></div>');

    // Get current styles to inject into iframe
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
              }, 3000); // 3-second cleanup for stability
            };
          </script>
        </body>
      </html>
    `;

    iframeDoc.open();
    iframeDoc.write(fullHtml);
    iframeDoc.close();

    // Resolve after the print dialog is triggered and cleanup is scheduled
    // Using a slightly shorter timeout than the cleanup to allow the next job to start
    setTimeout(resolve, 2500);
  });

  printQueue = printQueue.then(job).catch(job);
  return printQueue;
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
      // Fallback to iframe method — which now uses the same queue internally
      await printReceipt(data, settings);
    }
  };

  // Add to sequential queue
  printQueue = printQueue.then(executePrint).catch(executePrint);
  return printQueue;
};
