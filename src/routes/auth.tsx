import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const [val, setVal] = useState("");
  return (
    <div style={{ padding: 40, background: "#fff", color: "#000", minHeight: "100vh" }}>
      <h1>MINIMAL DIAGNOSTIC PAGE V2 (no head config)</h1>
      <input
        type="text"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="type here"
        style={{ border: "1px solid #000", padding: 8, fontSize: 16 }}
      />
      <p>Value: {val}</p>
    </div>
  );
}
