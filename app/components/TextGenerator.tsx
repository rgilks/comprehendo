"use client";

import { useState } from "react";

export default function TextGenerator() {
  const [text, setText] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const generateText = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt:
            "Generate a paragraph (8-10 sentences) of English text about a random interesting topic. Make it suitable for reading comprehension practice for English language learners.",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate text");
      }

      const data = await response.json();
      setText(data.result);
    } catch (err) {
      console.error("Error generating text:", err);
      setError("Failed to generate text. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto my-8">
      <button
        onClick={generateText}
        disabled={loading}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-blue-300 disabled:cursor-not-allowed"
      >
        {loading ? "Generating..." : "Generate English Text"}
      </button>

      {error && (
        <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {text && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-2 text-white">
            Generated Text:
          </h2>
          <div className="p-4 bg-gray-800 border border-gray-700 rounded shadow-sm text-white">
            <p className="leading-relaxed">{text}</p>
          </div>
        </div>
      )}
    </div>
  );
}
