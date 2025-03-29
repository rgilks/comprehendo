"use client";

import TextGenerator from "./components/TextGenerator";
import Link from "next/link";
import AuthButton from "./components/AuthButton";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-4 md:p-8 bg-gradient-to-br from-gray-900 via-indigo-950 to-gray-900">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-700/10 via-transparent to-transparent pointer-events-none"></div>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-green-700/10 via-transparent to-transparent pointer-events-none"></div>

      <div className="z-10 w-full max-w-5xl">
        <div className="flex justify-end mb-4">
          <AuthButton />
        </div>

        <div className="text-center py-10 md:py-16 fade-in">
          <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-blue-400 via-cyan-400 to-green-400 bg-clip-text text-transparent drop-shadow-sm">
            Comprehend
          </h1>
          <p className="text-xl mb-3 text-gray-300 max-w-2xl mx-auto">
            An AI-powered language learning tool to improve your reading
            comprehension
          </p>
        </div>

        <div className="fade-in" style={{ animationDelay: "0.2s" }}>
          <TextGenerator />
        </div>

        <footer
          className="mt-16 text-center text-sm text-gray-500 fade-in"
          style={{ animationDelay: "0.3s" }}
        >
          <p>
            Powered by OpenAI & Google Gemini |{" "}
            <Link
              href="https://github.com/rgilks/comprehend"
              className="underline hover:text-blue-400"
            >
              GitHub
            </Link>
          </p>
        </footer>
      </div>
    </main>
  );
}
