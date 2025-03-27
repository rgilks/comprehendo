import TextGenerator from "./components/TextGenerator";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-8">
      <div className="z-10 w-full max-w-5xl items-center justify-between">
        <h1 className="text-4xl font-bold mb-8 text-center text-white">
          Comprehend
        </h1>
        <p className="mb-4 text-center text-gray-300">
          An English Comprehension Game powered by OpenAI
        </p>
        <p className="mb-8 text-center text-gray-300">
          Generate a paragraph of English text to get started!
        </p>

        <TextGenerator />
      </div>
    </main>
  );
}
