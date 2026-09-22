
# 🚌 School Bus Trips Dashboard — Plug & Play Manual

Welcome! This dashboard is designed to work with **Firebase/Firestore by default**, but can easily be configured to connect to **any custom database or authentication system** (your own backend, custom APIs, SQL, etc).

---

## 🌟 Features

✅ Trip request management  
✅ Bus assignment & driver info  
✅ Status tracking (Pending, Accepted, Confirmed, Completed, etc.)  
✅ Staff & admin views  
✅ Filter & search  
✅ Modular service-based architecture for easy integration

---

## ⚡ Default configuration: Firebase

By default, the dashboard uses Firebase for both database and authentication.  

Firebase config is defined in:

```
client/src/firebase.js
```

It exports:
```js
export const db = getFirestore(app);
export const auth = getAuth(app);
```

---

## 🗂️ Key service files to connect your own systems

### ✉️ Trips service

File: `client/src/services/tripService.js`

All trip-related functions live here:
- Fetch trips
- Create trip
- Update trip
- Delete trip
- Get trips by user

🔧 **How to switch to your API:**

```js
// Example: using your REST API

export const getAllTrips = async () => {
  const res = await fetch(`${process.env.REACT_APP_API_URL}/api/trips`);
  return await res.json();
};

export const createTrip = async (tripData) => {
  const res = await fetch(`${process.env.REACT_APP_API_URL}/api/trips`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(tripData),
  });
  return await res.json();
};

// Do the same for updateTrip, deleteTrip, etc.
```

---

### 🔑 Auth service

File: `client/src/services/authService.js`

Handles:
- Sign in
- Sign up
- Get current user
- Sign out

🔧 **How to switch to your API or auth SDK:**

```js
export const loginUser = async (email, password) => {
  const res = await fetch(`${process.env.REACT_APP_API_URL}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return await res.json();
};

// Similarly replace other auth functions
```

---

## 🧑‍💻 Configuration file (optional)

File: `client/src/config/databaseConfig.js`

You can define and export your custom database connection object or endpoints here.  

Example:
```js
export const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";
```

Then import and use in service files.

---

## ⚙️ Steps to switch database & auth

1️⃣ Update `tripService.js` with your API or SDK calls.  
2️⃣ Update `authService.js` similarly.  
3️⃣ (Optional) Adjust `firebase.js` or remove if not needed.  
4️⃣ Add or update `.env` for your API URLs and secrets.  
5️⃣ Run locally:  
```bash
npm install
npm start
```
6️⃣ Build for production:  
```bash
npm run build
```
7️⃣ Deploy (e.g., Vercel, Netlify, etc.).

---

## 💬 FAQ

### ❓ Do I need to modify component files?

No! Components use service functions only. Once you update the services, everything will work.

---

### ❓ Can I use custom authentication (e.g., SSO, LDAP)?

Yes. You just need to update the logic in `authService.js`. Components won’t require changes.

---

### ❓ Can I keep Firebase for storage and use another database?

Yes! You can keep `firebase.js` for specific storage or file uploads, and use other services for data and auth.

---

## 🤝 Need help?

Feel free to contact the original developer or your IT team if you need assistance linking to your own backend.

---

## ✅ Summary

You can **plug in your own database and auth without touching UI code** by only changing service files. This gives you maximum flexibility while keeping the codebase clean and maintainable.

---

### 🚀 Happy trips!
