// Types
export * from "./types";
// Firebase
export { app, auth, rtdb, db, googleProvider } from "./firebaseConfig";
// RTDB Services
export * from "./rtdb/presenceService";
export * from "./rtdb/sessionGuard";
export { orderService } from "./rtdb/orderService";
export { stockService } from "./rtdb/stockService";
export { messStatusService } from "./rtdb/messStatusService";
// Transactions
export { processTransaction } from "./transactions/processTransaction";

// Services
export { timeSlotService } from "./services/timeSlotService";
export { menuService } from "./services/menuService";
export * from "./services/settingsService";
export {
  syncAllStudents,
  fetchAllStudents,
  subscribeStudents,
  batchReplaceStudents,
  addStudent,
  updateStudent,
  deleteStudent,
  deleteStudentCompletely,
  getStudentByRegNo,
  deductStudentBalance,
  studentService,
} from "./services/studentService";
export * from "./services/kotQueueService";

// Utilities
export * from "./formatters";
export * from "./utils/qrParser";

// Modules
export * from "./modules/ThermalPrinter";

