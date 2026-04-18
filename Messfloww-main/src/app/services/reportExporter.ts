/**
 * reportExporter.ts
 * Generic engine for converting report data into downloadable CSV files.
 */

// Helper to escape CSV strings
function escapeCSV(str: string | number | boolean | null | undefined): string {
  if (str === null || str === undefined) return "";
  const s = String(str);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Converts an array of objects to a CSV string and triggers a browser download.
 * 
 * @param data Array of objects to export
 * @param filename Custom filename (without .csv)
 * @param headerMap Optional map to rename headers (e.g., { 'regNo': 'Registration Number' })
 */
export function exportToCSV(data: any[], filename: string, headerMap: Record<string, string> = {}) {
  if (!data || !data.length) {
    console.warn("No data provided for CSV export");
    return;
  }

  // Extract keys from first object
  const keys = Object.keys(data[0]);
  
  // Build header row
  const headers = keys.map(k => headerMap[k] || k).join(",");
  
  // Build data rows
  const rows = data.map(row => 
    keys.map(k => escapeCSV(row[k])).join(",")
  );
  
  // Combine
  const csvContent = [headers, ...rows].join("\n");
  
  // Trigger download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
