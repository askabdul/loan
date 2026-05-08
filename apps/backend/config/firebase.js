const admin = require("firebase-admin");

let firebaseApp = null;

/**
 * Get or initialize the Firebase Admin app.
 * Requires FIREBASE_PROJECT_ID in .env.
 * For full token verification, also requires FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY
 * (from a downloaded service account key).
 */
const getFirebaseAdmin = () => {
  if (firebaseApp) return firebaseApp;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error("FIREBASE_PROJECT_ID is not set in environment variables");
  }

  const hasServiceAccount =
    process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY;

  const appConfig = hasServiceAccount
    ? {
        credential: admin.credential.cert({
          projectId,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          // Escape sequences in .env private keys need to be unescaped
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        }),
      }
    : { projectId };

  firebaseApp = admin.initializeApp(appConfig);
  return firebaseApp;
};

/**
 * Verify a Firebase ID token.
 * @param {string} idToken - Firebase ID token from the client
 * @returns {Promise<admin.auth.DecodedIdToken>}
 */
const verifyFirebaseToken = async (idToken) => {
  const app = getFirebaseAdmin();
  return admin.auth(app).verifyIdToken(idToken);
};

module.exports = { getFirebaseAdmin, verifyFirebaseToken };
