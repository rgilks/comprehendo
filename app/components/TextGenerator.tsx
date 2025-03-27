"use client";

import { useState } from "react";
import Image from "next/image";

type QuizData = {
  paragraph: string;
  question: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correctAnswer: string;
  topic: string;
};

type CEFRLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

const CEFR_LEVELS = {
  A1: "Beginner",
  A2: "Elementary",
  B1: "Intermediate",
  B2: "Upper Intermediate",
  C1: "Advanced",
  C2: "Proficiency",
};

export default function TextGenerator() {
  const [quizData, setQuizData] = useState<QuizData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState<boolean>(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState<boolean>(false);
  const [cefrLevel, setCefrLevel] = useState<CEFRLevel>("B1");

  const generateText = async () => {
    setLoading(true);
    setError(null);
    setSelectedAnswer(null);
    setIsAnswered(false);
    setImageUrl(null);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: `Generate a reading comprehension paragraph with a multiple choice question for CEFR level ${cefrLevel} (${CEFR_LEVELS[cefrLevel]}) English learners.`,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate text");
      }

      const data = await response.json();
      try {
        // Parse the JSON response from the string
        const jsonString = data.result.replace(/```json|```/g, "").trim();
        const parsedData = JSON.parse(jsonString);
        setQuizData(parsedData);

        // Generate image based on the topic
        generateImage(parsedData.topic);
      } catch (parseErr) {
        console.error("Error parsing JSON:", parseErr);
        setError("Failed to parse the generated quiz. Please try again.");
      }
    } catch (err) {
      console.error("Error generating text:", err);
      setError("Failed to generate text. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const generateImage = async (topic: string) => {
    setImageLoading(true);
    try {
      const response = await fetch("/api/image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: topic,
          level: cefrLevel,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate image");
      }

      const data = await response.json();
      setImageUrl(data.imageUrl);
    } catch (err) {
      console.error("Error generating image:", err);
      // We don't set an error here since the text content is still valuable
    } finally {
      setImageLoading(false);
    }
  };

  const handleAnswerSelect = (answer: string) => {
    setSelectedAnswer(answer);
  };

  const checkAnswer = () => {
    if (selectedAnswer) {
      setIsAnswered(true);
    }
  };

  const isCorrect = selectedAnswer === quizData?.correctAnswer;

  return (
    <div className="w-full max-w-2xl mx-auto my-8">
      <div className="mb-4 flex flex-col md:flex-row gap-4 items-start md:items-center">
        <div className="w-full md:w-auto">
          <label className="block text-sm font-medium text-white mb-1">
            CEFR Level:
          </label>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(CEFR_LEVELS) as CEFRLevel[]).map((level) => (
              <button
                key={level}
                onClick={() => setCefrLevel(level)}
                className={`px-3 py-1 text-sm rounded-full transition-colors ${
                  cefrLevel === level
                    ? "bg-blue-600 text-white"
                    : "bg-gray-700 text-gray-200 hover:bg-gray-600"
                }`}
              >
                {level} - {CEFR_LEVELS[level]}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={generateText}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-blue-300 disabled:cursor-not-allowed w-full md:w-auto"
        >
          {loading ? "Generating..." : "Generate English Text"}
        </button>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {quizData && (
        <div className="mt-6">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-xl font-semibold text-white">
              Reading Passage:
            </h2>
            <span className="text-sm bg-blue-600 text-white px-2 py-1 rounded-full">
              Level: {cefrLevel}
            </span>
          </div>

          {(imageLoading || imageUrl) && (
            <div className="mb-4 flex justify-center relative">
              {imageLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-70 z-10">
                  <div className="text-white">Loading image...</div>
                </div>
              )}
              {imageUrl && (
                <div className="w-full h-64 relative rounded overflow-hidden">
                  <img
                    src={imageUrl}
                    alt={quizData.topic}
                    className="object-contain w-full h-full"
                  />
                </div>
              )}
            </div>
          )}

          <div className="p-4 bg-gray-800 border border-gray-700 rounded shadow-sm text-white mb-4">
            <p className="leading-relaxed">{quizData.paragraph}</p>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded shadow-sm p-4 text-white">
            <h3 className="text-lg font-medium mb-3">Question:</h3>
            <p className="mb-4">{quizData.question}</p>

            <div className="space-y-2">
              {Object.entries(quizData.options).map(([key, value]) => (
                <div
                  key={key}
                  className={`p-2 border rounded cursor-pointer ${
                    selectedAnswer === key
                      ? "border-blue-500 bg-blue-900"
                      : "border-gray-600 hover:bg-gray-700"
                  } ${
                    isAnswered && key === quizData.correctAnswer
                      ? "border-green-500 bg-green-900"
                      : ""
                  }`}
                  onClick={() => !isAnswered && handleAnswerSelect(key)}
                >
                  <span className="font-bold mr-2">{key}:</span> {value}
                </div>
              ))}
            </div>

            {!isAnswered && (
              <button
                onClick={checkAnswer}
                disabled={!selectedAnswer}
                className="mt-4 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Check Answer
              </button>
            )}

            {isAnswered && (
              <div
                className={`mt-4 p-3 rounded ${
                  isCorrect ? "bg-green-900" : "bg-red-900"
                }`}
              >
                <p className="font-medium">
                  {isCorrect
                    ? "Correct! Well done!"
                    : `Incorrect. The correct answer is ${quizData.correctAnswer}.`}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
