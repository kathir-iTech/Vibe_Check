"use client";
import { useState } from "react";

export function DemoMode() {
  const [loaded, setLoaded] = useState(false);
  return (
    <div>
      <button onClick={() => setLoaded(true)}>Load Demo Data</button>
      {loaded && (
        <div>
          <h3>Demo Verdicts</h3>
          <p>Claim: "I added authentication and all tests pass" &#8594; UNVERIFIED (sample data)</p>
          <p>Claim: "I implemented the user profile page" &#8594; UNVERIFIED (sample data)</p>
          <p>Claim: "I refactored the API client" &#8594; TRUE (sample data)</p>
        </div>
      )}
    </div>
  );
}
