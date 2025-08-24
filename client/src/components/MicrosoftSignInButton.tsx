// client/src/components/MicrosoftSignInButton.tsx

import { useMsal } from "@azure/msal-react";

const scopesForYourApi = ["api://YOUR_API_APP_ID/access_as_user"]; // replace

export default function MicrosoftSignInButton() {
  const { instance } = useMsal();

  const login = async () => {
    await instance.loginPopup({ scopes: ["User.Read", ...scopesForYourApi] });
    // you are signed in; tokens can be acquired silently next
  };

  return (
    <button onClick={login} className="px-4 py-2 rounded bg-blue-600 text-white">
      Sign in with Microsoft 365
    </button>
  );
}
