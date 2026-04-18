import { Student } from "../context/StudentContext";
import { MenuItem, MealType } from "../context/MenuContext";

export interface CSVParseResult<T> {
  valid: T[];
  errors: { row: number; field: string; message: string }[];
}

/**
 * Parses Student CSV
 * Headers: Name, Registration Number, Credits, Email, Phone Number
 */
export const parseStudentCSV = (text: string): CSVParseResult<Student> => {
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) {
    return { valid: [], errors: [{ row: 0, field: "file", message: "Empty file or missing headers" }] };
  }

  const students: Student[] = [];
  const errors: { row: number; field: string; message: string }[] = [];
  
  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const columns = lines[i].split(",").map(col => col.trim());
    
    if (columns.length < 5) {
      errors.push({ row: i + 1, field: "row", message: "Missing columns (expected 5)" });
      continue;
    }

    const [name, regNo, creditsStr, email, phone] = columns;
    const credits = parseInt(creditsStr);

    let rowValid = true;

    if (!name) {
      errors.push({ row: i + 1, field: "Name", message: "Name is required" });
      rowValid = false;
    }
    if (!regNo) {
      errors.push({ row: i + 1, field: "Registration Number", message: "Reg No is required" });
      rowValid = false;
    }
    if (isNaN(credits) || credits < 0) {
      errors.push({ row: i + 1, field: "Credits", message: "Credits must be a number ≥ 0" });
      rowValid = false;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push({ row: i + 1, field: "Email", message: "Invalid email format" });
      rowValid = false;
    }
    if (!phone) {
      errors.push({ row: i + 1, field: "Phone Number", message: "Phone is required" });
      rowValid = false;
    }

    if (rowValid) {
      students.push({
        id: Date.now() + i,
        name,
        regNo,
        email,
        phone,
        balance: credits || 0, // Now mapped correctly from CSV
        credits: credits || 0,
        status: "active"
      });
    }
  }

  return { valid: students, errors };
};

/**
 * Triggers a download of a sample Student CSV template
 */
export const downloadStudentTemplate = () => {
  const headers = "Name,Registration Number,Credits,Email,Phone Number\n";
  const example = "Rahul Kumar,21BCE1234,15,rahul.kumar@vitstudent.ac.in,9876543210\n";
  const blob = new Blob([headers + example], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "student_template.csv";
  link.click();
};

/**
 * Parses Menu CSV
 * Headers: Menu Item, Category, Price, Slot, GST, MRP, Stock, Min Stock
 */
export const parseMenuCSV = (text: string): CSVParseResult<MenuItem> => {
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) {
    return { valid: [], errors: [{ row: 0, field: "file", message: "Empty file or missing headers" }] };
  }

  const items: MenuItem[] = [];
  const errors: { row: number; field: string; message: string }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const columns = lines[i].split(",").map(col => col.trim());
    
    if (columns.length < 6) {
      errors.push({ row: i + 1, field: "row", message: "Missing columns (expected at least 6)" });
      continue;
    }

    const [name, category, priceStr, slotRaw, gstStr, mrpRaw, stockStr, minStockStr] = columns;
    const price = parseInt(priceStr);
    const gst = parseInt(gstStr);
    const slot = slotRaw.toLowerCase();
    const isMRP = mrpRaw.toLowerCase() === "yes";
    const stock = parseInt(stockStr) || 0;
    const minStock = parseInt(minStockStr) || 0;

    let rowValid = true;

    if (!name) {
      errors.push({ row: i + 1, field: "Menu Item", message: "Item name is required" });
      rowValid = false;
    }
    if (isNaN(price) || price <= 0) {
      errors.push({ row: i + 1, field: "Price", message: "Price must be a number > 0" });
      rowValid = false;
    }
    if (isNaN(gst) || gst < 0 || gst > 100) {
      errors.push({ row: i + 1, field: "GST", message: "GST must be between 0 and 100" });
      rowValid = false;
    }

    if (rowValid) {
      items.push({
        id: Date.now() + i,
        name,
        category: category || "General",
        price,
        slot: slot as MealType,
        gst,
        isMRP,
        available: true,
        isVeg: true, // Default to Veg
        stock: stock,
        initialStock: stock,
        minStock: minStock,
        lowStockAlert: false
      });
    }
  }

  return { valid: items, errors };
};

/**
 * Triggers a download of a sample Menu CSV template
 */
export const downloadMenuTemplate = () => {
  const headers = "Menu Item,Category,Price,Slot,GST,MRP,Stock,Min Stock\n";
  const example = "Masala Dosa,Main Course,45,Breakfast,5,no,100,10\n";
  const blob = new Blob([headers + example], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "menu_template.csv";
  link.click();
};
