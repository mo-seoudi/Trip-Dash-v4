import admin from "firebase-admin";
import dotenv from "dotenv";
dotenv.config();

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      type: "service_account",
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      // You can also include other fields if needed
      // private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      // client_id: process.env.FIREBASE_CLIENT_ID,
      // auth_uri: process.env.FIREBASE_AUTH_URI,
      // token_uri: process.env.FIREBASE_TOKEN_URI,
      // auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
      // client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
    }),
  });
}

export default admin;
