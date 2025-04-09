import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { type Language, SPEECH_LANGUAGES } from '@/contexts/LanguageContext';
import { type CEFRLevel } from '@/config/language-guidance';
import { generateExerciseResponse } from '@/app/actions/exercise';
import { getProgress, submitAnswer } from '@/app/actions/userProgress';
import { getSession } from 'next-auth/react';

// --- Quiz data schema (PARTIAL - for client state) --- START
// Define the shape directly if Zod isn't used here
interface PartialQuizDataClient {
  paragraph: string;
  question: string;
  options: { A: string; B: string; C: string; D: string };
  topic: string;
}
// Use the interface for the state type
export type QuizData = PartialQuizDataClient;
// --- Quiz data schema (PARTIAL - for client state) --- END

interface TranslationResponse {
  responseStatus: number;
  responseData: {
    translatedText: string;
  };
}

// Define the API response schema for generation if needed for typing, otherwise remove
// Remove if `apiResponseSchema` was only for Zod parsing previously

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
  currentQuizId: number | null;
  selectedAnswer: string | null;
  isAnswered: boolean;
  relevantTextRange: { start: number; end: number } | null;

  // Feedback state
  feedbackIsCorrect: boolean | null;
  feedbackCorrectAnswer: string | null;
  feedbackExplanations: { A: string; B: string; C: string; D: string } | null;
  feedbackRelevantText: string | null;

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
  handleAnswerSelect: (answer: string) => void;
  stopPassageSpeech: () => void;
  handlePlayPause: () => void;
  handleStop: () => void;
  getTranslation: (word: string, sourceLang: string, targetLang: string) => Promise<string>;
  speakText: (text: string | null, lang: Language) => void;
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
    currentQuizId: null,
    selectedAnswer: null,
    isAnswered: false,
    relevantTextRange: null,
    feedbackIsCorrect: null,
    feedbackCorrectAnswer: null,
    feedbackExplanations: null,
    feedbackRelevantText: null,

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
    setShowLoginPrompt: (show) => set({ showLoginPrompt: show }),

    setPassageLanguage: (lang) => {
      const { stopPassageSpeech, questionDelayTimeoutRef, fetchUserProgress } = get();

      // Stop audio and clear any pending question reveal
      stopPassageSpeech();
      if (questionDelayTimeoutRef) {
        clearTimeout(questionDelayTimeoutRef);
      }

      set((state) => {
        // Reset UI and quiz state
        state.passageLanguage = lang;
        state.quizData = null;
        state.selectedAnswer = null;
        state.isAnswered = false;
        state.showExplanation = false;
        state.showQuestionSection = false;
        state.currentWordIndex = null;
        state.relevantTextRange = null;
        state.error = null;
        state.loading = false;
        state.showContent = false;
        state.generatedPassageLanguage = null;
        state.generatedQuestionLanguage = null;
        state.questionDelayTimeoutRef = null;
      });

      // Fetch progress for the new language
      void fetchUserProgress();
    },

    setCefrLevel: (level) => set({ cefrLevel: level }),

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
      const { stopPassageSpeech, generatedQuestionLanguage, questionDelayTimeoutRef } = get();

      // Stop any ongoing speech and clear delays
      stopPassageSpeech();
      if (questionDelayTimeoutRef) {
        clearTimeout(questionDelayTimeoutRef);
      }

      set((state) => {
        state.loading = true;
        state.error = null;
        state.showContent = true;
        state.quizData = null;
        state.currentQuizId = null;
        state.selectedAnswer = null;
        state.isAnswered = false;
        state.showExplanation = false;
        state.showQuestionSection = false;
        state.relevantTextRange = null;
        state.currentWordIndex = null;
        state.feedbackIsCorrect = null;
        state.feedbackCorrectAnswer = null;
        state.feedbackExplanations = null;
        state.feedbackRelevantText = null;
        state.generatedPassageLanguage = null;
        state.generatedQuestionLanguage = generatedQuestionLanguage;
        state.questionDelayTimeoutRef = null;
      });

      // Timeout to allow loading state to render
      setTimeout(() => {
        stopPassageSpeech(); // Ensure speech is stopped again

        void (async () => {
          // Get necessary state values
          const currentPassageLanguage = get().passageLanguage;
          const currentCefrLevel = get().cefrLevel;
          const currentQuestionLanguage = get().generatedQuestionLanguage || 'en';

          try {
            console.log('[Store] Calling generateExerciseResponse action with:');
            console.log(
              '[Store] Passage Lang:',
              currentPassageLanguage,
              'Question Lang:',
              currentQuestionLanguage,
              'Level:',
              currentCefrLevel
            );

            const MAX_RETRIES = 2;
            let currentRetry = 0;
            let success = false;
            let response: Awaited<ReturnType<typeof generateExerciseResponse>> | null = null;

            while (currentRetry < MAX_RETRIES && !success) {
              try {
                response = await generateExerciseResponse({
                  passageLanguage: currentPassageLanguage,
                  questionLanguage: currentQuestionLanguage,
                  cefrLevel: currentCefrLevel,
                });

                if (response.error || !response.quizId) {
                  throw new Error(response.error || 'Failed to retrieve Quiz ID');
                }

                // --- Parse PARTIAL data (Remove Zod validation) --- START
                // Server action already ensures this structure
                const parsedPartialData = JSON.parse(response.result) as QuizData;
                // --- Parse PARTIAL data --- END

                set((state) => {
                  state.quizData = parsedPartialData; // Use the parsed data directly
                  state.currentQuizId = response?.quizId ?? null;
                  state.generatedPassageLanguage = currentPassageLanguage;
                  state.generatedQuestionLanguage = currentQuestionLanguage;
                  state.loading = false;
                  state.error = null;
                  // Reset feedback state
                  state.feedbackIsCorrect = null;
                  state.feedbackCorrectAnswer = null;
                  state.feedbackExplanations = null;
                  state.feedbackRelevantText = null;
                });

                // Determine reading time and schedule question display
                const delay = response.cached ? 500 : 2000; // Use fixed delay for now

                console.log(`[Store] Delaying question reveal by ${delay}ms`);

                const timeoutId = setTimeout(() => {
                  set((state) => {
                    state.showQuestionSection = true;
                    state.questionDelayTimeoutRef = null;
                  });
                }, delay);
                set((state) => {
                  state.questionDelayTimeoutRef = timeoutId;
                });

                success = true;
              } catch (err: unknown) {
                currentRetry++;
                // Check if err is an Error before accessing message
                const message =
                  err instanceof Error ? err.message : 'Unknown error during generation attempt';
                console.error(`[Store] Attempt ${currentRetry}/${MAX_RETRIES} failed:`, message);
                if (currentRetry >= MAX_RETRIES) {
                  throw err;
                } else {
                  await new Promise((resolve) => setTimeout(resolve, 1000));
                }
              }
            }
          } catch (err: unknown) {
            console.error('[Store] Error generating text:', err);
            // Check if err is an Error before accessing message
            const message = err instanceof Error ? err.message : 'Failed to generate text';
            set((state) => {
              state.error = message;
              state.loading = false;
            });
          }
        })();
      }, 100);
    },

    // Handle answer selection
    handleAnswerSelect: (answer) => {
      const { currentQuizId, quizData, stopPassageSpeech, generatedQuestionLanguage, isAnswered } =
        get();

      // Ensure we have a quiz ID and haven't answered yet
      if (!currentQuizId || !quizData || isAnswered || !generatedQuestionLanguage) return;

      stopPassageSpeech();

      // Immediately mark as answered and store the selection
      set((state) => {
        state.selectedAnswer = answer;
        state.isAnswered = true;
        state.showExplanation = false;
        state.relevantTextRange = null;
        state.feedbackIsCorrect = null;
        state.feedbackCorrectAnswer = null;
        state.feedbackExplanations = null;
        state.feedbackRelevantText = null;
        state.error = null;
      });

      // Call the server action to submit answer and get feedback
      void (async () => {
        try {
          const { generatedPassageLanguage, cefrLevel } = get(); // Get current passage language and level

          if (!generatedPassageLanguage || !generatedQuestionLanguage) {
            throw new Error('Generated languages not available for submission.');
          }

          const payload: {
            ans: string;
            learn: string;
            lang: string;
            id: number;
            cefrLevel?: string; // Optional
          } = {
            ans: answer, // Use 'ans'
            learn: generatedPassageLanguage, // Language being learned
            lang: generatedQuestionLanguage, // Language of the questions
            id: currentQuizId, // Use 'id'
          };

          // Only include cefrLevel if it's not A1 (default)
          if (cefrLevel && cefrLevel !== 'A1') {
            payload.cefrLevel = cefrLevel;
          }

          // Call submitAnswer with the new payload structure
          const result = await submitAnswer(payload);

          if (result.error) {
            console.error(`[Feedback/Progress] Error: ${result.error}`);
            set((state) => {
              state.error = `Feedback Error: ${result.error}`;
            });
          } else {
            // --- Update state with feedback and progress from server --- START
            set((state) => {
              // Update progress state
              state.userStreak = result.currentStreak;
              if (result.leveledUp) {
                state.cefrLevel = result.currentLevel as CEFRLevel;
                console.log(`[Progress] Leveled up to ${result.currentLevel}!`);
              }

              // Store the received feedback data
              if (result.feedback) {
                state.feedbackIsCorrect = result.feedback.isCorrect;
                state.feedbackCorrectAnswer = result.feedback.correctAnswer;
                state.feedbackExplanations = result.feedback.explanations;
                state.feedbackRelevantText = result.feedback.relevantText;

                // Find and set relevant text range based on feedbackRelevantText
                if (state.feedbackRelevantText && state.quizData?.paragraph) {
                  const startIndex = state.quizData.paragraph.indexOf(state.feedbackRelevantText);
                  if (startIndex !== -1) {
                    state.relevantTextRange = {
                      start: startIndex,
                      end: startIndex + state.feedbackRelevantText.length,
                    };
                  } else {
                    state.relevantTextRange = null;
                  }
                } else {
                  state.relevantTextRange = null;
                  // Clear feedback state if none received (shouldn't happen on success)
                  state.feedbackIsCorrect = null;
                  state.feedbackCorrectAnswer = null;
                  state.feedbackExplanations = null;
                  state.feedbackRelevantText = null;
                }
              } else {
                state.relevantTextRange = null;
                // Clear feedback state if none received (shouldn't happen on success)
                state.feedbackIsCorrect = null;
                state.feedbackCorrectAnswer = null;
                state.feedbackExplanations = null;
                state.feedbackRelevantText = null;
              }

              // Schedule the explanation display
              setTimeout(
                () =>
                  set((state) => {
                    state.showExplanation = true;
                  }),
                50
              );
            });
            // --- Update state with feedback and progress from server --- END
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Unknown feedback/progress error';
          console.error('[Feedback/Progress] Error submitting answer:', message);
          set((state) => {
            state.error = `Error submitting answer: ${message}`;
          });
          // Show explanation even on error? Maybe or show error message instead.
          // setTimeout(() => set((state) => { state.showExplanation = true; }), 100);
        }
      })();
    },

    // Complex operation: Reset quiz with new data while maintaining history
    resetQuizWithNewData: (newQuizData: QuizData) => {
      set((state) => {
        const previousTopic = state.quizData?.topic;

        // Reset state, including feedback
        state.quizData = newQuizData; // Assign new partial data
        state.selectedAnswer = null;
        state.isAnswered = false;
        state.showExplanation = false;
        state.relevantTextRange = null;
        state.currentWordIndex = null;
        state.currentQuizId = null; // Also reset quiz ID
        state.feedbackIsCorrect = null;
        state.feedbackCorrectAnswer = null;
        state.feedbackExplanations = null;
        state.feedbackRelevantText = null;
        state.error = null;

        state.loading = false;
        state.showContent = true;
        state.showQuestionSection = false;

        // Topic handling remains the same
        if (previousTopic && previousTopic === newQuizData.topic && state.quizData) {
          state.quizData.topic = `${newQuizData.topic} (revisited)`;
        }
      });
    },
  }))
);

export default useTextGeneratorStore;
