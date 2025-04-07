import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { z } from 'zod';
import { type Language, LANGUAGES, SPEECH_LANGUAGES } from '@/contexts/LanguageContext';
import { type CEFRLevel } from '@/config/language-guidance';
import { getRandomTopicForLevel } from '@/config/topics';
import { getVocabularyGuidance, getGrammarGuidance } from '@/config/language-guidance';
import { generateExerciseResponse } from '@/app/actions/exercise';
import { getProgress, updateProgress } from '@/app/actions/userProgress';
import { getSession } from 'next-auth/react';

// Quiz data schema
const quizDataSchema = z.object({
  paragraph: z.string(),
  question: z.string(),
  options: z.object({
    A: z.string(),
    B: z.string(),
    C: z.string(),
    D: z.string(),
  }),
  explanations: z.object({
    A: z.string(),
    B: z.string(),
    C: z.string(),
    D: z.string(),
  }),
  correctAnswer: z.string(),
  relevantText: z.string(),
  topic: z.string(),
});

export type QuizData = z.infer<typeof quizDataSchema>;

interface TranslationResponse {
  responseStatus: number;
  responseData: {
    translatedText: string;
  };
}

// Define the API response schema
const apiResponseSchema = z.object({
  result: z.string(),
});

interface TextGeneratorState {
  // UI state
  loading: boolean;
  error: string | null;
  showLoginPrompt: boolean;
  showContent: boolean;
  showQuestionSection: boolean;
  showExplanation: boolean;
  isProgressLoading: boolean;

  // Language/settings state
  passageLanguage: Language;
  generatedPassageLanguage: Language | null;
  generatedQuestionLanguage: Language | null;
  cefrLevel: CEFRLevel;

  // Quiz state
  quizData: QuizData | null;
  selectedAnswer: string | null;
  isAnswered: boolean;
  relevantTextRange: { start: number; end: number } | null;

  // Audio state
  isSpeechSupported: boolean;
  isSpeakingPassage: boolean;
  isPaused: boolean;
  volume: number;
  currentWordIndex: number | null;

  // User state
  userStreak: number | null;

  // Refs to maintain
  passageUtteranceRef: SpeechSynthesisUtterance | null;
  wordsRef: string[];
  questionDelayTimeoutRef: NodeJS.Timeout | null;

  // Actions
  setShowLoginPrompt: (show: boolean) => void;
  setPassageLanguage: (lang: Language) => void;
  setCefrLevel: (level: CEFRLevel) => void;
  setVolumeLevel: (volume: number) => void;
  fetchUserProgress: () => Promise<void>;
  generateText: () => void;
  handleAnswerSelect: (answer: string) => Promise<void>;
  stopPassageSpeech: () => void;
  handlePlayPause: () => void;
  handleStop: () => void;
  getTranslation: (word: string, sourceLang: string, targetLang: string) => Promise<string>;
  speakText: (text: string | null, lang: Language) => void;
  updateQuizOptionAndExplanation: (
    optionKey: 'A' | 'B' | 'C' | 'D',
    newText: string,
    newExplanation: string
  ) => void;
  resetQuizWithNewData: (newQuizData: QuizData) => void;
}

export const useTextGeneratorStore = create(
  immer<TextGeneratorState>((set, get) => ({
    // Initial state
    loading: false,
    error: null,
    showLoginPrompt: true,
    showContent: true,
    showQuestionSection: false,
    showExplanation: false,
    isProgressLoading: false,

    passageLanguage: 'en',
    generatedPassageLanguage: null,
    generatedQuestionLanguage: null,
    cefrLevel: 'A1',

    quizData: null,
    selectedAnswer: null,
    isAnswered: false,
    relevantTextRange: null,

    isSpeechSupported: false,
    isSpeakingPassage: false,
    isPaused: false,
    volume: 0.5,
    currentWordIndex: null,

    userStreak: null,

    passageUtteranceRef: null,
    wordsRef: [],
    questionDelayTimeoutRef: null,

    // Simple setters
    setShowLoginPrompt: (show) =>
      set((state) => {
        state.showLoginPrompt = show;
      }),
    setPassageLanguage: (lang) => {
      set((state) => {
        state.passageLanguage = lang;
      });

      const { fetchUserProgress } = get();
      void fetchUserProgress();
    },
    setCefrLevel: (level) =>
      set((state) => {
        state.cefrLevel = level;
      }),

    setVolumeLevel: (volume) => {
      set((state) => {
        state.volume = volume;
      });
      const { passageUtteranceRef } = get();

      if (passageUtteranceRef) {
        passageUtteranceRef.volume = volume;
      }

      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        if (passageUtteranceRef) {
          passageUtteranceRef.volume = volume;
          window.speechSynthesis.speak(passageUtteranceRef);
          set((state) => {
            state.isSpeakingPassage = true;
            state.isPaused = false;
          });
        }
      }
    },

    // Stop speech
    stopPassageSpeech: () => {
      const { isSpeechSupported } = get();
      if (isSpeechSupported) {
        window.speechSynthesis.cancel();
        set((state) => {
          state.isSpeakingPassage = false;
          state.isPaused = false;
          state.currentWordIndex = null;
          state.passageUtteranceRef = null;
        });
      }
    },

    // Play/pause speech
    handlePlayPause: () => {
      const {
        isSpeechSupported,
        quizData,
        generatedPassageLanguage,
        isSpeakingPassage,
        isPaused,
        volume,
        stopPassageSpeech,
      } = get();

      if (!isSpeechSupported || !quizData?.paragraph || !generatedPassageLanguage) return;

      if (isSpeakingPassage) {
        if (isPaused) {
          window.speechSynthesis.resume();
          set((state) => {
            state.isPaused = false;
          });
        } else {
          window.speechSynthesis.pause();
          set((state) => {
            state.isPaused = true;
          });
        }
      } else {
        stopPassageSpeech();

        const words = quizData.paragraph.split(/\s+/);
        set((state) => {
          state.wordsRef = words;
        });

        const utterance = new SpeechSynthesisUtterance(quizData.paragraph);
        utterance.lang = SPEECH_LANGUAGES[generatedPassageLanguage];
        utterance.volume = volume;

        set((state) => {
          state.passageUtteranceRef = utterance;
        });

        utterance.onboundary = (event) => {
          if (event.name === 'word') {
            let wordIndex = 0;
            let charCount = 0;
            for (let i = 0; i < words.length; i++) {
              charCount += words[i].length + 1;
              if (charCount > event.charIndex) {
                wordIndex = i;
                break;
              }
            }
            set((state) => {
              state.currentWordIndex = wordIndex;
            });
          }
        };

        utterance.onend = () => {
          set((state) => {
            state.isSpeakingPassage = false;
            state.isPaused = false;
            state.currentWordIndex = null;
            state.passageUtteranceRef = null;
          });
        };

        utterance.onerror = (event) => {
          if (event.error !== 'interrupted') {
            console.error('Speech synthesis error (passage):', event.error);
            set((state) => {
              state.isSpeakingPassage = false;
              state.isPaused = false;
              state.currentWordIndex = null;
              state.passageUtteranceRef = null;
            });
          }
        };

        window.speechSynthesis.speak(utterance);
        set((state) => {
          state.isSpeakingPassage = true;
          state.isPaused = false;
        });
      }
    },

    // Stop button handler
    handleStop: () => {
      const { stopPassageSpeech } = get();
      stopPassageSpeech();
    },

    // Speak a single word
    speakText: (text, lang) => {
      const { isSpeechSupported, stopPassageSpeech, volume } = get();

      if (!isSpeechSupported || !text) {
        return;
      }

      stopPassageSpeech();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = SPEECH_LANGUAGES[lang];
      utterance.volume = volume;

      utterance.onerror = (event) => {
        console.error('Speech synthesis error (word):', event.error);
      };

      window.speechSynthesis.speak(utterance);
    },

    // Translation service
    getTranslation: async (word, sourceLang, targetLang) => {
      try {
        const response = await fetch(
          `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=${sourceLang}|${targetLang}`
        );

        if (!response.ok) throw new Error('Translation failed');

        const data = (await response.json()) as TranslationResponse;
        if (data.responseStatus === 200 && data.responseData?.translatedText) {
          return data.responseData.translatedText;
        }
        throw new Error('No translation available');
      } catch (error) {
        console.error('Translation error:', error);
        return word; // Return original word on error
      }
    },

    // Fetch user progress
    fetchUserProgress: async () => {
      // Get session status first
      const session = await getSession(); // Use NextAuth getSession client-side

      // Only proceed if authenticated (session is not null)
      if (!session) {
        console.log('[Progress] User not authenticated, skipping fetchUserProgress.');
        // Optionally reset local progress state if needed
        set((state) => {
          state.cefrLevel = 'A1';
          state.userStreak = 0;
        });
        return;
      }

      const { passageLanguage } = get();
      set((state) => {
        state.isProgressLoading = true;
      });

      try {
        const result = await getProgress({ language: passageLanguage });

        if (result.error) {
          throw new Error(result.error);
        }

        set((state) => {
          state.cefrLevel = (result.currentLevel || 'A1') as CEFRLevel;
          state.userStreak = result.currentStreak || 0;
        });
        console.log(`[Progress] Fetched user progress for ${passageLanguage}:`, result);
      } catch (err) {
        console.error(`[Progress] Error fetching user progress for ${passageLanguage}:`, err);
        set((state) => {
          state.cefrLevel = 'A1';
          state.userStreak = 0;
        });
      } finally {
        set((state) => {
          state.isProgressLoading = false;
        });
      }
    },

    // Generate text
    generateText: () => {
      const { stopPassageSpeech, passageLanguage, cefrLevel, questionDelayTimeoutRef } = get();

      // First hide content with animation
      set((state) => {
        state.showContent = false;
      });

      // Wait for exit animation to complete before starting new content generation
      // Using a regular timeout instead of async/await to avoid React state issues
      setTimeout(() => {
        stopPassageSpeech();
        set((state) => {
          state.loading = true;
          state.error = null;
          state.quizData = null;
          state.selectedAnswer = null;
          state.isAnswered = false;
          state.showExplanation = false;
          state.showQuestionSection = false;
          state.currentWordIndex = null;
          state.relevantTextRange = null;
        });

        if (questionDelayTimeoutRef) {
          clearTimeout(questionDelayTimeoutRef);
          set((state) => {
            state.questionDelayTimeoutRef = null;
          });
        }

        const levelToUse = cefrLevel;

        try {
          // Get a random topic appropriate for the current CEFR level
          const randomTopic = getRandomTopicForLevel(levelToUse);

          // This function is intentionally not async/await since it manages its own
          // async flow with promises and uses the store's state through closures
          void (async () => {
            try {
              // Get vocabulary and grammar guidance for the current level
              const vocabGuidance = getVocabularyGuidance(levelToUse);
              const grammarGuidance = getGrammarGuidance(levelToUse);

              const passageLanguageName = LANGUAGES[passageLanguage] || passageLanguage;
              // Get the user's selected language (interface language) for questions
              const questionLanguage = get().generatedQuestionLanguage || 'en';
              const questionLanguageName = LANGUAGES[questionLanguage] || questionLanguage;

              // Add language guidance to the prompt for A1 and A2 levels
              let languageInstructions = '';
              if (['A1', 'A2'].includes(levelToUse)) {
                languageInstructions = `\n\nVocabulary guidance: ${vocabGuidance}\n\nGrammar guidance: ${grammarGuidance}`;
              }

              const prompt = `Generate a reading passage in ${passageLanguageName} suitable for CEFR level ${levelToUse} about the topic "${randomTopic}". The passage should be interesting and typical for language learners at this stage. After the passage, provide a multiple-choice comprehension question about it, four answer options (A, B, C, D), indicate the correct answer letter, provide a brief topic description (3-5 words in English) for image generation, provide explanations for each option being correct or incorrect, and include the relevant text snippet from the passage supporting the correct answer. FORMAT THE QUESTION, OPTIONS, AND EXPLANATIONS IN ${questionLanguageName}. This is extremely important - the question and all answer options must be in ${questionLanguageName}, not in ${passageLanguageName}. Respond ONLY with the JSON object.${languageInstructions}`;

              const seed = Math.floor(Math.random() * 100);

              console.log('[API] Sending request with prompt:', prompt.substring(0, 100) + '...');
              console.log(
                '[API] Passage Lang:',
                passageLanguage,
                'Question Lang:',
                questionLanguage,
                'Level:',
                levelToUse,
                'Topic:',
                randomTopic
              );

              const MAX_RETRIES = 2;
              let currentRetry = 0;
              let forceCache = false;
              let success = false;

              // Keep trying until we succeed or exhaust all options
              while (!success && (currentRetry <= MAX_RETRIES || !forceCache)) {
                try {
                  const requestBody = {
                    prompt,
                    seed,
                    passageLanguage,
                    questionLanguage,
                    forceCache,
                    languageRequirement: `Generate passage in ${passageLanguageName}, but questions/options/explanations in ${questionLanguageName}`,
                  };

                  // Use server action directly
                  console.log('[API] Using server action');
                  const response = await generateExerciseResponse(requestBody);

                  // Validate the response with Zod schema
                  const validatedResponse = apiResponseSchema.parse(response);
                  const result = validatedResponse.result;

                  if (!result) {
                    throw new Error('No result received');
                  }

                  try {
                    // The server has already validated this against the quiz schema
                    const jsonData = JSON.parse(result) as z.infer<typeof quizDataSchema>;
                    console.log('[Debug] JSON parse successful');

                    // The server has already validated against the schema, but we do a final check
                    // This provides type safety but shouldn't fail under normal circumstances
                    const validatedData = quizDataSchema.parse(jsonData);

                    set((state) => {
                      state.quizData = validatedData;
                      state.generatedPassageLanguage = passageLanguage;
                    });

                    // --- Calculate Dynamic Question Delay ---
                    const WPM = 250; // Lower WPM for a quicker appearance
                    const wordCount = validatedData.paragraph.split(/\s+/).filter(Boolean).length;
                    const readingTimeMs = (wordCount / WPM) * 60 * 1000;
                    const bufferMs = 1500; // Further reduce buffer for a more responsive feel
                    const minDelayMs = 1500; // Shorter minimum delay
                    const questionDelayMs = Math.max(minDelayMs, readingTimeMs + bufferMs);
                    console.log(
                      `[DelayCalc] Words: ${wordCount}, Est. Read Time: ${readingTimeMs.toFixed(0)}ms, Delay Set: ${questionDelayMs.toFixed(0)}ms`
                    );
                    // --- End Calculate Delay ---

                    // Start timer to show question section using calculated delay, but with a cross-fade effect
                    const timeoutId = setTimeout(() => {
                      // When it's time to show the question, first make sure content is visible
                      if (!get().showContent)
                        set((state) => {
                          state.showContent = true;
                        });

                      // Short delay to ensure content is visible before showing question
                      setTimeout(() => {
                        set((state) => {
                          state.showQuestionSection = true;
                        });
                      }, 100);
                    }, questionDelayMs);

                    set((state) => {
                      state.questionDelayTimeoutRef = timeoutId;
                    });
                    success = true;
                  } catch (error) {
                    console.error('Error parsing generated quiz JSON:', error);
                    throw new Error('Failed to parse the structure of the generated quiz.');
                  }
                } catch (err) {
                  console.error(`Error during attempt ${currentRetry + 1}:`, err);
                  if (currentRetry < MAX_RETRIES) {
                    // If we have retries left, increment the counter and try again
                    currentRetry++;
                    console.log(`Retrying... Attempt ${currentRetry + 1} of ${MAX_RETRIES + 1}`);
                    const delay = Math.pow(2, currentRetry) * 1000; // Exponential backoff
                    await new Promise((resolve) => setTimeout(resolve, delay));
                  } else if (!forceCache) {
                    // We've exhausted our retries, try the cache as last resort
                    console.log('Retries exhausted, trying to force cache retrieval');
                    forceCache = true;
                    currentRetry = 0; // Reset retry counter for the cache attempt
                  } else {
                    // We've tried retries and cache, now show error
                    if (err instanceof Error) {
                      set((state) => {
                        state.error = err.message;
                      });
                    } else {
                      set((state) => {
                        state.error = 'An error occurred during text generation';
                      });
                    }
                    throw err; // Re-throw to exit the retry loop
                  }
                }
              }
            } catch (error) {
              console.error('All attempts failed:', error);
            } finally {
              set((state) => {
                state.loading = false;
                state.showContent = true;
              });
            }
          })();
        } catch (error) {
          console.error('Failed to start text generation:', error);
          set((state) => {
            state.loading = false;
            state.showContent = true;
            state.error = 'Failed to start generation process';
          });
        }
      }, 500);
    },

    // Handle answer selection
    handleAnswerSelect: async (answer) => {
      const { quizData, isAnswered, stopPassageSpeech, generatedPassageLanguage } = get();

      if (isAnswered || !quizData) return;

      stopPassageSpeech();
      set((state) => {
        state.selectedAnswer = answer;
        state.isAnswered = true;
        state.showExplanation = false;
        state.relevantTextRange = null; // Reset range initially
      });

      // Find and set the relevant text range
      if (quizData.relevantText && quizData.paragraph) {
        const startIndex = quizData.paragraph.indexOf(quizData.relevantText);
        if (startIndex !== -1) {
          set((state) => {
            state.relevantTextRange = {
              start: startIndex,
              end: startIndex + quizData.relevantText.length,
            };
          });
          console.log(
            `[Highlight] Relevant text range found: ${startIndex} - ${startIndex + quizData.relevantText.length}`
          );
        } else {
          console.warn(
            '[Highlight] Relevant text not found exactly in paragraph:',
            quizData.relevantText
          );
        }
      }

      // Update user progress if authenticated
      try {
        const result = await updateProgress({
          isCorrect: answer === quizData.correctAnswer,
          language: generatedPassageLanguage || '',
        });

        if (result.error) {
          console.error(`[Progress] Error: ${result.error}`);
        } else {
          set((state) => {
            state.userStreak = result.currentStreak;
          });

          // First check for level up
          if (result.leveledUp) {
            set((state) => {
              state.cefrLevel = result.currentLevel as CEFRLevel;
            });
            console.log(`[Progress] Leveled up to ${result.currentLevel}!`);
          }
        }
      } catch (err) {
        console.error('[Progress] Error updating progress:', err);
      }

      setTimeout(
        () =>
          set((state) => {
            state.showExplanation = true;
          }),
        100
      );
    },

    // Example of a complex update that would be hard without Immer
    updateQuizOptionAndExplanation: (
      optionKey: 'A' | 'B' | 'C' | 'D',
      newText: string,
      newExplanation: string
    ) => {
      set((state) => {
        if (state.quizData) {
          state.quizData.options[optionKey] = newText;
          state.quizData.explanations[optionKey] = newExplanation;
        }
      });
    },

    // Complex operation: Reset quiz with new data while maintaining history
    resetQuizWithNewData: (newQuizData: QuizData) => {
      set((state) => {
        const previousTopic = state.quizData?.topic;

        state.quizData = newQuizData;
        state.selectedAnswer = null;
        state.isAnswered = false;
        state.showExplanation = false;
        state.relevantTextRange = null;
        state.currentWordIndex = null;

        state.loading = false;
        state.showContent = true;
        state.showQuestionSection = false;

        if (previousTopic && previousTopic === newQuizData.topic) {
          state.quizData.topic = `${newQuizData.topic} (revisited)`;
        }
      });
    },
  }))
);

export default useTextGeneratorStore;
