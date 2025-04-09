import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { type Language, SPEECH_LANGUAGES } from '@/contexts/LanguageContext';
import { type CEFRLevel } from '@/config/language-guidance';
import { getProgress, submitAnswer } from '@/app/actions/userProgress';
import { getSession } from 'next-auth/react';

// --- Quiz data schema (PARTIAL - for client state) --- START
// Re-import PartialQuizData from exercise action if needed, or define locally
import type { PartialQuizData } from '@/app/actions/exercise';

// Define QuizData type used within the store
// Make QuizData a simple alias if it has no additional members
type QuizData = PartialQuizData;
// interface QuizData extends PartialQuizData {
//   // Add any other client-side specific fields if necessary in the future
// }

// Define the shape of the pre-fetched quiz data
interface NextQuizInfo {
  quizData: QuizData;
  quizId: number;
}

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

  // State to hold pre-fetched next quiz
  nextQuizAvailable: NextQuizInfo | null;

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
  loadNextQuiz: () => void;
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

    // State to hold pre-fetched next quiz
    nextQuizAvailable: null,

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
      const {
        nextQuizAvailable,
        passageLanguage,
        cefrLevel,
        loading,
        loadNextQuiz,
        stopPassageSpeech,
        questionDelayTimeoutRef,
      } = get();

      if (loading) return; // Prevent concurrent requests

      // If a next quiz is already fetched, just load it
      if (nextQuizAvailable) {
        console.log('[Store] Loading pre-fetched next quiz.');
        loadNextQuiz();
        return;
      }

      console.log('[Store] No pre-fetched quiz, generating new one...');

      // Stop audio and clear any pending question reveal
      stopPassageSpeech();
      if (questionDelayTimeoutRef) {
        clearTimeout(questionDelayTimeoutRef);
      }

      set((state) => {
        state.loading = true;
        state.error = null;
        state.quizData = null;
        state.currentQuizId = null;
        state.selectedAnswer = null;
        state.isAnswered = false;
        state.showExplanation = false;
        state.showQuestionSection = false;
        state.currentWordIndex = null;
        state.relevantTextRange = null;
        state.feedbackIsCorrect = null;
        state.feedbackCorrectAnswer = null;
        state.feedbackExplanations = null;
        state.feedbackRelevantText = null;
        state.nextQuizAvailable = null; // Ensure cleared
        state.generatedPassageLanguage = passageLanguage;
        // Assume question language matches passage language for generation request?
        // Or get it from context? Let's assume it matches passage lang for now.
        state.generatedQuestionLanguage = passageLanguage;
        state.showContent = false;
        state.questionDelayTimeoutRef = null;
      });

      // Call submitAnswer without ans/id to get the first/new quiz
      void (async () => {
        try {
          const uiLanguage = get().passageLanguage; // Use passage lang as placeholder for UI lang

          const payload: {
            learn: string;
            lang: string;
            cefrLevel?: string;
          } = {
            learn: passageLanguage,
            lang: uiLanguage, // Need to get actual UI language ideally
          };
          if (cefrLevel && cefrLevel !== 'A1') {
            payload.cefrLevel = cefrLevel;
          }

          const result = await submitAnswer(payload);

          if (result.error || !result.nextQuiz?.quizData || !result.nextQuiz.quizId) {
            throw new Error(result.error || 'Failed to generate or parse quiz data');
          }

          // Successfully got the first quiz
          const nextQuiz = result.nextQuiz; // Ensure result.nextQuiz is defined here

          set((state) => {
            state.quizData = nextQuiz.quizData as QuizData;
            state.currentQuizId = nextQuiz.quizId ?? null;
            // Update level/streak based on response (might be fetched from DB)
            state.cefrLevel = (result.currentLevel || 'A1') as CEFRLevel; // Fix: Use cefrLevel
            state.userStreak = result.currentStreak || 0;
            state.generatedPassageLanguage = passageLanguage;
            state.generatedQuestionLanguage = uiLanguage;
            state.loading = false;
            state.showContent = true; // Show the new content
            state.error = null;
            // Show question immediately
            state.showQuestionSection = true;
            state.questionDelayTimeoutRef = null; // Clear ref
          });
          console.log('[Store] First quiz loaded:', nextQuiz);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Unknown generation error';
          console.error('[Store] Error generating text:', message);
          set((state) => {
            state.error = `Failed to generate exercise: ${message}`;
            state.loading = false;
          });
        }
      })();
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
        state.nextQuizAvailable = null; // Clear any previously available quiz
      });

      // Call the server action to submit answer and get feedback + next quiz
      void (async () => {
        try {
          const { generatedPassageLanguage, cefrLevel } = get();

          if (!generatedPassageLanguage || !generatedQuestionLanguage) {
            throw new Error('Generated languages not available for submission.');
          }

          const payload: {
            ans: string;
            learn: string;
            lang: string;
            id: number;
            cefrLevel?: string;
          } = {
            ans: answer,
            learn: generatedPassageLanguage,
            lang: generatedQuestionLanguage,
            id: currentQuizId,
          };

          if (cefrLevel && cefrLevel !== 'A1') {
            payload.cefrLevel = cefrLevel;
          }

          const result = await submitAnswer(payload);

          if (result.error && !result.feedback) {
            console.error(`[Feedback/Progress] Server Action Error: ${result.error}`);
            set((state) => {
              state.error = `Server Error: ${result.error}`;
              state.isAnswered = true;
              state.showExplanation = false;
            });
          } else {
            set((state) => {
              state.userStreak = result.currentStreak;
              if (result.leveledUp) {
                state.cefrLevel = result.currentLevel as CEFRLevel;
                console.log(`[Progress] Leveled up to ${result.currentLevel}!`);
              }

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
                }
              } else {
                // Clear feedback state if none received
                state.relevantTextRange = null;
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

              // --- Store the pre-fetched next quiz --- START
              if (result.nextQuiz && result.nextQuiz.quizData && result.nextQuiz.quizId) {
                console.log('[Store] Storing pre-fetched next quiz:', result.nextQuiz.quizId);
                state.nextQuizAvailable = {
                  quizData: result.nextQuiz.quizData,
                  quizId: result.nextQuiz.quizId,
                };
              } else {
                state.nextQuizAvailable = null; // Ensure cleared if generation failed
                if (result.nextQuiz && result.nextQuiz.error) {
                  console.error('[Store] Failed to pre-fetch next quiz:', result.nextQuiz.error);
                  // Optionally show non-blocking error?
                  // state.error = `Note: Failed to pre-load next exercise: ${result.nextQuiz.error}`;
                }
              }
              // --- Store the pre-fetched next quiz --- END
            });
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Unknown feedback/progress error';
          console.error('[Feedback/Progress] Error submitting answer:', message);
          set((state) => {
            state.error = `Error submitting answer: ${message}`;
            state.nextQuizAvailable = null; // Clear on error too
          });
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

    // --- NEW: loadNextQuiz Action ---
    loadNextQuiz: () => {
      const { nextQuizAvailable, stopPassageSpeech, questionDelayTimeoutRef } = get();

      if (!nextQuizAvailable) {
        console.warn('[Store] loadNextQuiz called but no quiz available.');
        return;
      }

      // Stop audio and clear any pending question reveal
      stopPassageSpeech();
      // Clear potentially existing timeout ref from previous quiz load
      if (questionDelayTimeoutRef) {
        clearTimeout(questionDelayTimeoutRef);
      }

      set((state) => {
        console.log('[Store] Loading next quiz ID:', nextQuizAvailable.quizId);
        // Set the new quiz data
        state.quizData = nextQuizAvailable.quizData;
        state.currentQuizId = nextQuizAvailable.quizId;

        // Reset UI state for the new quiz
        state.selectedAnswer = null;
        state.isAnswered = false;
        state.showExplanation = false;
        // Show question immediately
        state.showQuestionSection = true;
        state.currentWordIndex = null;
        state.relevantTextRange = null;
        state.feedbackIsCorrect = null;
        state.feedbackCorrectAnswer = null;
        state.feedbackExplanations = null;
        state.feedbackRelevantText = null;
        state.error = null;
        state.loading = false; // Ensure loading is false
        state.showContent = true;

        // Clear the pre-fetched data
        state.nextQuizAvailable = null;

        // Clear timeout ref
        state.questionDelayTimeoutRef = null;

        // Assume languages remain the same, or update if needed from quizData?
        // state.generatedPassageLanguage = ...;
        // state.generatedQuestionLanguage = ...;

        // Schedule question reveal
        // state.questionDelayTimeoutRef = setTimeout(() => {
        //   set({ showQuestionSection: true });
        // }, 2000); // 2 second delay
      });
    },
  }))
);

export default useTextGeneratorStore;
