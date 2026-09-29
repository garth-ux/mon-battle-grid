import React from "react";
import ReactDOM from "react-dom/client";
import App3D from "./App3D.tsx";
import "./index.css";

// To use the original 2D version, change App3D to App
// import App from "./App.tsx";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App3D />
  </React.StrictMode>,
);
