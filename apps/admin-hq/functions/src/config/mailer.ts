import * as nodemailer from "nodemailer";
import * as functions from "firebase-functions";

// For Resend via nodemailer, the SMTP configuration is:
// Host: smtp.resend.com
// Port: 465
// Username: resend
// Password: <your-resend-api-key>

let processEnvConfig = process.env.RESEND_API_KEY;

// Alternatively, configure via Firebase CLI:
// firebase functions:config:set resend.apikey="re_123456789"
let firebaseConfig: any;
try {
  firebaseConfig = functions.config().resend?.apikey;
} catch (e) {
  firebaseConfig = undefined;
}

const API_KEY = processEnvConfig || firebaseConfig || "YOUR_RESEND_API_KEY_HERE";

export const transporter = nodemailer.createTransport({
  host: "smtp.resend.com",
  port: 465,
  secure: true, // Use TLS
  auth: {
    user: "resend",
    pass: API_KEY, // This is your Resend API Key
  },
});

export const SENDER_EMAIL = "reports@messflow.com"; // Must be verified in Resend domain settings
