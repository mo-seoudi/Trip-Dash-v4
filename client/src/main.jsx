import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

import "./index.css"; // Or whatever your main CSS file is

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
