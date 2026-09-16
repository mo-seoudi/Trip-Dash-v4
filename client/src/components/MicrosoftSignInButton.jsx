// client/src/components/MicrosoftSignInButton.jsx
import { useMsal } from "@azure/msal-react";

export default function MicrosoftSignInButton() {
  const { instance } = useMsal();

  async function login() {
    const apiScope = String(import.meta.env.VITE_MS_API_SCOPE || "").trim();
    if (!apiScope) {
      alert("Microsoft integration is not configured.");
      return;
    }

    const result = await instance.loginPopup({ scopes: ["User.Read", apiScope] });
    if (result?.account) instance.setActiveAccount(result.account);
  }

  return (
    <button onClick={login} className="px-4 py-2 rounded bg-blue-600 text-white">
      Connect Microsoft 365
    </button>
  );
}
