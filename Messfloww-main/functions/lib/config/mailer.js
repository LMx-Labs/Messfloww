"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SENDER_EMAIL = exports.transporter = void 0;
const nodemailer = __importStar(require("nodemailer"));
const functions = __importStar(require("firebase-functions"));
// For Resend via nodemailer, the SMTP configuration is:
// Host: smtp.resend.com
// Port: 465
// Username: resend
// Password: <your-resend-api-key>
let processEnvConfig = process.env.RESEND_API_KEY;
// Alternatively, configure via Firebase CLI:
// firebase functions:config:set resend.apikey="re_123456789"
let firebaseConfig;
try {
    firebaseConfig = (_a = functions.config().resend) === null || _a === void 0 ? void 0 : _a.apikey;
}
catch (e) {
    firebaseConfig = undefined;
}
const API_KEY = processEnvConfig || firebaseConfig || "YOUR_RESEND_API_KEY_HERE";
exports.transporter = nodemailer.createTransport({
    host: "smtp.resend.com",
    port: 465,
    secure: true, // Use TLS
    auth: {
        user: "resend",
        pass: API_KEY, // This is your Resend API Key
    },
});
exports.SENDER_EMAIL = "reports@messflow.com"; // Must be verified in Resend domain settings
//# sourceMappingURL=mailer.js.map