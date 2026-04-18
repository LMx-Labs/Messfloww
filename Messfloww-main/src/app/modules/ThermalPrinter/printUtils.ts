import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { ThermalReceipt } from './ThermalReceipt';
import { BillDocument, ReceiptSettings } from './types';

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
            body { margin: 0; padding: 0; }
            .thermal-receipt-wrapper { display: block !important; visibility: visible !important; }
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
