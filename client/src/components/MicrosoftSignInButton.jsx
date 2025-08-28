// client/src/components/MicrosoftSignInButton.jsx
import { useMsal } from "@azure/msal-react";

// TODO: replace with your real API app id in Entra
const API_SCOPE = "api://YOUR_API_APP_ID/access_as_user";

export default function MicrosoftSignInButton() {
  const { instance } = useMsal();

  async function login() {
    await instance.loginPopup({ scopes: ["User.Read", API_SCOPE] });
    alert("Signed in with Microsoft!");
  }

  return (
    <button onClick={login} className="px-4 py-2 rounded bg-blue-600 text-white">
      Sign in with Microsoft 365
    </button>
  );
}
