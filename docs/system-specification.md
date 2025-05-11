# System Specification

This document outlines the system specification based on the automated tests.

## Test Suites and Cases

### `lib/utils/speech.test.ts`

- speech utilities > getPlatformInfo > should detect iOS using userAgentData
- speech utilities > getPlatformInfo > should detect macOS using userAgentData
- speech utilities > getPlatformInfo > should detect Windows using userAgentData
- speech utilities > getPlatformInfo > should detect iOS using userAgent fallback
- speech utilities > getPlatformInfo > should detect iPadOS using userAgent fallback
- speech utilities > getPlatformInfo > should detect macOS using userAgent fallback
- speech utilities > getPlatformInfo > should detect Windows using userAgent fallback
- speech utilities > getPlatformInfo > should handle unknown platform using userAgent fallback
- speech utilities > filterAndFormatVoices > should return empty array if window is undefined
- speech utilities > filterAndFormatVoices > should return empty array if getVoices returns null
- speech utilities > filterAndFormatVoices > should filter voices for English (en) on Windows
- speech utilities > filterAndFormatVoices > should filter voices for German (de) on Windows
- speech utilities > filterAndFormatVoices > should filter voices for English (en) on macOS
- speech utilities > filterAndFormatVoices > should filter voices for German (de) on macOS
- speech utilities > filterAndFormatVoices > should filter voices for English (en) on iOS
- speech utilities > filterAndFormatVoices > should filter voices for German (de) on iOS
- speech utilities > filterAndFormatVoices > should handle languages with no available voices
- speech utilities > filterAndFormatVoices > should correctly deduplicate voices based on display name

### `lib/repositories/quizRepository.test.ts`

- QuizRepository Functions > findQuizById > should return a parsed quiz if found and valid
- QuizRepository Functions > findQuizById > should return null if quiz is not found
- QuizRepository Functions > findQuizById > should return null if quiz row structure is invalid
- QuizRepository Functions > findQuizById > should return null if quiz content JSON is invalid
- QuizRepository Functions > findQuizById > should return null if quiz content fails QuizContentSchema validation
- QuizRepository Functions > findQuizById > should throw error if database query fails
- QuizRepository Functions > createQuiz > should insert a new quiz and return the last insert row ID
- QuizRepository Functions > createQuiz > should handle null questionLanguage and userId
- QuizRepository Functions > createQuiz > should throw error if JSON stringify fails
- QuizRepository Functions > createQuiz > should throw error if database insert fails
- QuizRepository Functions > findSuitableQuizForUser > should query with user exclusion if userId is provided
- QuizRepository Functions > findSuitableQuizForUser > should query without user exclusion if userId is null
- QuizRepository Functions > findSuitableQuizForUser > should return null if no suitable quiz is found
- QuizRepository Functions > findSuitableQuizForUser > should return null if found row is invalid
- QuizRepository Functions > findSuitableQuizForUser > should return null if found content JSON is invalid
- QuizRepository Functions > findSuitableQuizForUser > should return null if cached quiz content fails QuizContentSchema validation
- QuizRepository Functions > findSuitableQuizForUser > should throw error if database query fails
- QuizRepository Functions > saveExercise > should insert a new exercise using content JSON and return the last insert row ID
- QuizRepository Functions > saveExercise > should handle null questionLanguage and userId
- QuizRepository Functions > saveExercise > should throw error if database insert fails
- QuizRepository Functions > countExercises > should return the count of exercises matching the criteria
- QuizRepository Functions > countExercises > should return 0 if no exercises are found
- QuizRepository Functions > countExercises > should return 0 if count is null or undefined
- QuizRepository Functions > countExercises > should throw error if database query fails

### `lib/exercise-cache.test.ts`

- Exercise Cache Functions > getCachedExercise > should return a quiz row for a logged-in user when found
- Exercise Cache Functions > getCachedExercise > should return undefined for a logged-in user when not found
- Exercise Cache Functions > getCachedExercise > should return a quiz row for an anonymous user when found
- Exercise Cache Functions > getCachedExercise > should return undefined for an anonymous user when not found
- Exercise Cache Functions > getCachedExercise > should return undefined on database error
- Exercise Cache Functions > saveExerciseToCache > should return the new quiz ID on successful insert
- Exercise Cache Functions > saveExerciseToCache > should handle null userId correctly during insert
- Exercise Cache Functions > saveExerciseToCache > should return undefined if insert fails to return an ID
- Exercise Cache Functions > saveExerciseToCache > should return undefined on database error
- Exercise Cache Functions > countCachedExercises > should return the count when found
- Exercise Cache Functions > countCachedExercises > should return 0 if no count is found
- Exercise Cache Functions > countCachedExercises > should return 0 on database error
- Exercise Cache Functions > getValidatedExerciseFromCache > should return validated partial data when cache hit and data is valid
- Exercise Cache Functions > getValidatedExerciseFromCache > should return validated partial data for anonymous user
- Exercise Cache Functions > getValidatedExerciseFromCache > should return undefined if getCachedExercise returns undefined (cache miss)
- Exercise Cache Functions > getValidatedExerciseFromCache > should return undefined and log error if JSON parsing fails
- Exercise Cache Functions > getValidatedExerciseFromCache > should return undefined and log error if QuizData validation fails
- Exercise Cache Functions > getValidatedExerciseFromCache > should return undefined if the underlying DB call in getCachedExercise fails

### `app/store/audioSlice.test.ts`

- audioSlice > setIsSpeechSupported > should set isSpeechSupported to true and set up onvoiceschanged
- audioSlice > setIsSpeechSupported > should set isSpeechSupported to false
- audioSlice > setIsSpeechSupported > should not set onvoiceschanged if typeof window is undefined
- audioSlice > sets volume level
- audioSlice > setVolumeLevel restarts speech if speaking
- audioSlice > setVolumeLevel does not restart speech if paused
- audioSlice > stops passage speech and cancels synthesis
- audioSlice > handles play/pause toggle and interacts with synthesis
- audioSlice > handles stop and cancels synthesis
- audioSlice > sets selected voice URI and restarts if speaking
- audioSlice > sets selected voice URI without restarting if not speaking
- audioSlice > updates available voices and selects default if needed
- audioSlice > caches translation result
- audioSlice > returns null for empty or same language translation
- audioSlice > speakText does nothing if not supported or no text
- audioSlice > speakText calls synthesis speak with correct parameters
- audioSlice > speakText uses selected voice if available
- audioSlice > getTranslation returns cached translation if available
- audioSlice > getTranslation cleans word and calls translate action
- audioSlice > getTranslation handles translation failure and sets error
- audioSlice > updateAvailableVoices does nothing if speech not supported
- audioSlice > updateAvailableVoices calls filterAndFormatVoices and updates state
- audioSlice > updateAvailableVoices keeps existing selection if available
- audioSlice > updateAvailableVoices selects null if no voices are returned
- audioSlice > handlePlayPause sets up utterance and handles onboundary
- audioSlice > handlePlayPause sets up utterance and handles onend
- audioSlice > handlePlayPause onerror handling > should log info for interrupted error
- audioSlice > handlePlayPause onerror handling > should log error for other errors
- audioSlice > speakText handles onerror event
- audioSlice > speakText handles interrupted error event

### `app/store/quizSlice.test.ts`

- quizSlice > should initialize with default values
- quizSlice > setQuizData should update quizData
- quizSlice > setSelectedAnswer should update selectedAnswer
- quizSlice > setIsAnswered should update isAnswered
- quizSlice > setRelevantTextRange should update relevantTextRange
- quizSlice > setNextQuizAvailable should update nextQuizAvailable
- quizSlice > resetQuizState should reset quiz related state
- quizSlice > resetQuizWithNewData should reset state and set new quiz data
- quizSlice > loadNextQuiz should call resetQuizWithNewData if next quiz is available
- quizSlice > loadNextQuiz should call generateText if next quiz is not available
- quizSlice > useHoverCredit should decrement credits and return true if available
- quizSlice > useHoverCredit should return false if no credits available
- quizSlice > generateText > should generate text, reset state, and set new data when not prefetching
- quizSlice > generateText > should prefetch next quiz data without resetting state
- quizSlice > generateText > should handle API error gracefully during prefetch (should not set error state)
- quizSlice > handleAnswerSelect > should submit answer, update feedback (correct), and find relevant text
- quizSlice > handleAnswerSelect > should submit answer, update feedback (incorrect)
- quizSlice > handleAnswerSelect > should update level if leveledUp is true
- quizSlice > handleAnswerSelect > should handle hover progression phase logic (correct answer, initial phase, meets threshold)
- quizSlice > handleAnswerSelect > should handle hover progression phase logic (correct answer, initial phase, below threshold)
- quizSlice > handleAnswerSelect > should handle hover progression phase logic (incorrect answer, initial phase)
- quizSlice > handleAnswerSelect > should handle hover progression phase logic (correct answer, credits phase)
- quizSlice > handleAnswerSelect > should set error if currentQuizId is missing
- quizSlice > handleAnswerSelect > should set error if generatedQuestionLanguage is missing
- quizSlice > handleAnswerSelect > should handle API error during submission
- quizSlice > handleAnswerSelect > should handle API response with error property
- quizSlice > handleAnswerSelect > should handle Zod validation error during submission
- quizSlice > handleAnswerSelect > should not submit if already answered
- quizSlice > submitFeedback > should set error if currentQuizId is missing
- quizSlice > submitFeedback > should set error if generatedQuestionLanguage is missing
- quizSlice > submitFeedback > should handle API error response (success: false)
- quizSlice > submitFeedback > should handle API error response (success: false, no error message)
- quizSlice > submitFeedback > should handle thrown error during submission
- quizSlice > submitFeedback > should handle thrown non-error object during submission
- quizSlice > fetchInitialPair > should fetch initial pair, update state, and set loading states
- quizSlice > fetchInitialPair > should handle API error during fetchInitialPair
- quizSlice > fetchInitialPair > should handle validation error for fetchInitialPair response
- quizSlice > fetchInitialPair > should handle thrown error during fetchInitialPair
- quizSlice > fetchInitialPair > should reset quiz state correctly before fetching
- SKIPPED: quizSlice > generateText > should set error state if API call fails and not prefetching
- SKIPPED: quizSlice > generateText > should set error and not update data if ExerciseContentSchema validation fails
- SKIPPED: quizSlice > generateText > should set error and not update data if GenerateExerciseResultSchema validation fails
- SKIPPED: quizSlice > generateText > should handle non-Error object thrown from generateExercise
- SKIPPED: quizSlice > generateText > should set error if generateExercise throws an error

### `app/actions/exercise.test.ts`

- generateExerciseResponse > should return generated exercise when allowed and cache is low
- generateExerciseResponse > should look up user ID if session exists
- generateExerciseResponse > should return cached exercise when rate limit exceeded
- generateExerciseResponse > should return rate limit error if rate limited and no cache found
- generateExerciseResponse > should return cached exercise when cache count is high
- generateExerciseResponse > should attempt generation if cache count is high but cache lookup fails
- generateExerciseResponse > should return error if generation fails (AI call error) and no cache fallback
- generateExerciseResponse > should return error if generation fails (JSON parsing) and no cache fallback
- generateExerciseResponse > should return error if generation fails with non-Error object
- generateExerciseResponse > should return validation error for invalid input params
- generateExerciseResponse > should return specific error if AI response processing fails
- generateExerciseResponse > should return specific error if cache save fails
- generateExerciseResponse > should return error if saveExerciseToCache returns undefined
- generateExerciseResponse > should return error if ExerciseContentSchema safeParse fails
- generateExerciseResponse > should return error if GenerateExerciseResultSchema safeParse fails for cached data
- generateExerciseResponse > should log warning and attempt cache when generation fails (but not save error)
- additional branch coverage for generateExerciseResponse > should log originalError stack if AIResponseProcessingError.originalError is Error
- additional branch coverage for generateExerciseResponse > should log originalError as non-Error object if AIResponseProcessingError.originalError is not Error
- additional edge cases > should handle AI generator returning null
- additional edge cases > should handle large input values
- additional edge cases > should always return all option letters
- additional edge cases > should handle malformed session object
- additional edge cases > should separate cache for different users
- generateInitialExercisePair > should successfully generate a pair of exercises
- generateInitialExercisePair > should return error if rate limit exceeded
- generateInitialExercisePair > should return error if validation fails
- generateInitialExercisePair > should return error if first exercise generation fails
- generateInitialExercisePair > should return error if second exercise generation fails
- generateInitialExercisePair > should return error if both exercise generations fail
- generateInitialExercisePair > should return error if exercise generation throws
- generateInitialExercisePair > should return error if result validation fails

### `app/actions/progress.test.ts`

- User Progress Server Actions > updateProgress > should handle error cases 0
- User Progress Server Actions > updateProgress > should return Invalid parameters for invalid input
- User Progress Server Actions > updateProgress > should call calculateAndUpdateProgress and return its result on success
- User Progress Server Actions > updateProgress > should return error from calculateAndUpdateProgress if it fails
- User Progress Server Actions > submitAnswer > should handle invalid input 0
- User Progress Server Actions > submitAnswer > should return Missing or invalid quiz ID if id is missing
- User Progress Server Actions > submitAnswer > should return Quiz data unavailable if quiz is not found
- User Progress Server Actions > submitAnswer > should return Quiz data unavailable if quiz content parsing fails
- User Progress Server Actions > submitAnswer > should process answer and update progress for authenticated user 0
- User Progress Server Actions > submitAnswer > should process answer and update progress for authenticated user 1
- User Progress Server Actions > submitAnswer > should generate feedback but not update progress for anonymous user
- User Progress Server Actions > submitAnswer > should return error from calculateAndUpdateProgress if it fails
- User Progress Server Actions > getProgress > should handle error cases 0
- User Progress Server Actions > getProgress > should handle error cases 1
- User Progress Server Actions > getProgress > should fetch and return existing progress for authenticated user
- User Progress Server Actions > getProgress > should return default progress if no record exists for authenticated user
- User Progress Server Actions > getProgress > should handle repository error during progress fetch
- User Progress Server Actions > submitFeedback > should handle error cases 0
- User Progress Server Actions > submitFeedback > should handle error cases 1
- User Progress Server Actions > submitFeedback > should return Quiz not found if quiz ID does not exist
- User Progress Server Actions > submitFeedback > should call createFeedback and return success if quiz exists and repo call succeeds
- User Progress Server Actions > submitFeedback > should handle optional userAnswer and isCorrect
- User Progress Server Actions > submitFeedback > should return error if repository createFeedback fails

### `app/components/TextGenerator/TranslatableWord.test.tsx`

- TranslatableWord > renders the word correctly
- TranslatableWord > calls speakText on click
- TranslatableWord > does not attempt translation if fromLang and toLang are the same
- TranslatableWord > fetches and displays translation on click and hover when languages differ
- TranslatableWord > shows "Translating..." while fetching translation
- TranslatableWord > uses cached translation if available
- TranslatableWord > decrements hover credit when translating in "credits" phase
- TranslatableWord > does not fetch translation if no hover credits are available in "credits" phase
- TranslatableWord > applies "isCurrentWord" styling
- TranslatableWord > applies "isRelevant" styling and data-testid
- TranslatableWord > applies "isClicked" styling after click and translation fetched
- TranslatableWord > applies hover underline styling when appropriate
- TranslatableWord > handles click correctly when translation is blocked (no credits)
- TranslatableWord > handles missing speech codes gracefully
- TranslatableWord > handles getTranslation returning null or undefined
- SKIPPED: TranslatableWord > shows error message if translation fails

### `app/admin/hooks/useAdminTableData.test.tsx`

- useAdminTableData > should initialize with default values
- useAdminTableData > should fetch table names on mount
- useAdminTableData > should handle error when fetching table names
- useAdminTableData > should fetch data when a table is selected
- useAdminTableData > should handle error when fetching table data
- useAdminTableData > should paginate to the next page
- useAdminTableData > should paginate to the previous page
- useAdminTableData > should not paginate beyond the last page
- useAdminTableData > should not paginate before the first page
- useAdminTableData > should refresh data for the current table
- useAdminTableData > should not refresh if no table is selected
- useAdminTableData > should handle thrown error when fetching table names
- useAdminTableData > should handle thrown error when fetching table data

### `lib/auth/callbacks.test.ts`

- Auth Callbacks > signInCallback > should return true and call upsertUserOnSignIn on successful sign in
- Auth Callbacks > signInCallback > should return true if account is null
- Auth Callbacks > signInCallback > should return true if user has no email (repository handles internal check)
- Auth Callbacks > signInCallback > should return false if upsertUserOnSignIn throws an error
- Auth Callbacks > jwtCallback > should add provider, email, dbId, and isAdmin (false) to token for regular user
- Auth Callbacks > jwtCallback > should add isAdmin (true) to token for admin user
- Auth Callbacks > jwtCallback > should not add dbId if findUserByProvider returns null
- Auth Callbacks > jwtCallback > should not add dbId if findUserByProvider throws an error
- Auth Callbacks > jwtCallback > should return original token if account or user is missing
- Auth Callbacks > jwtCallback > should handle user without email gracefully
- Auth Callbacks > sessionCallback > should add id, dbId, isAdmin, and provider to session user from token
- Auth Callbacks > sessionCallback > should handle missing optional token fields gracefully
- Auth Callbacks > sessionCallback > should handle token dbId being non-numeric (should not happen but test defensively)
- Auth Callbacks > sessionCallback > should handle token isAdmin being non-boolean

### `app/actions/exercise-logic.test.ts`

- Exercise Logic Functions > tryGenerateAndCacheExercise > returns success with ExerciseContent and id on successful generation and cache
- Exercise Logic Functions > tryGenerateAndCacheExercise > returns failure if generateAndValidateExercise throws %p Error: AI failed
- Exercise Logic Functions > tryGenerateAndCacheExercise > returns failure if generateAndValidateExercise throws %p Error: Generic failure
- Exercise Logic Functions > tryGenerateAndCacheExercise > returns failure if generateAndValidateExercise throws %p 123
- Exercise Logic Functions > tryGenerateAndCacheExercise > returns failure if generateAndValidateExercise throws %p null
- Exercise Logic Functions > tryGenerateAndCacheExercise > returns failure if saveExerciseToCache returns undefined
- Exercise Logic Functions > tryGenerateAndCacheExercise > returns failure if saveExerciseToCache throws an error
- Exercise Logic Functions > tryGenerateAndCacheExercise > returns failure if saveExerciseToCache throws a non-Error value
- Exercise Logic Functions > tryGetCachedExercise > returns cached exercise if found
- Exercise Logic Functions > tryGetCachedExercise > returns null if no cached exercise is found
- Exercise Logic Functions > createErrorResponse > creates a standard error response object
- Exercise Logic Functions > createErrorResponse > includes details if provided
- Exercise Logic Functions > validateRequestParams > validates correct params
- Exercise Logic Functions > validateRequestParams > invalidates incorrect params
- Exercise Logic Functions > validateRequestParams > invalidates missing params
- Exercise Logic Functions > getOrGenerateExercise > returns correct result for cachedCount=10 (preferGenerate=false)
- Exercise Logic Functions > getOrGenerateExercise > returns correct result for cachedCount=99 (preferGenerate=false)
- Exercise Logic Functions > getOrGenerateExercise > returns correct result for cachedCount=100 (preferGenerate=true)
- Exercise Logic Functions > getOrGenerateExercise > returns correct result for cachedCount=200 (preferGenerate=true)
- Exercise Logic Functions > getOrGenerateExercise > returns generation error if cache is low, generation and cache fallback both fail
- Exercise Logic Functions > getOrGenerateExercise > returns generation error if cache is low and generation fails (terminal cache error)
- Exercise Logic Functions > getOrGenerateExercise > returns generation error if cache is high, cache lookup and generation both fail

### `lib/ai/google-ai-api.test.ts`

- callGoogleAI > should return parsed JSON object when response is valid JSON without fences
- callGoogleAI > should return parsed JSON array when response is valid JSON array without fences
- callGoogleAI > should return parsed JSON object when response is valid JSON with fences
- callGoogleAI > should use the environment variable for model name if set
- callGoogleAI > should use the default model name if environment variable is not set
- callGoogleAI > should throw AIResponseProcessingError if response text is undefined
- callGoogleAI > should throw AIResponseProcessingError if response text is not JSON and not fenced
- callGoogleAI > should throw AIResponseProcessingError if fenced content is not valid JSON
- callGoogleAI > should throw AIResponseProcessingError if generateContent throws a generic error
- callGoogleAI > should correctly re-throw AIResponseProcessingError with its originalError if nested
- callGoogleAI > should throw AIResponseProcessingError with safety message if generateContent throws a SAFETY error
- callGoogleAI > should throw AIResponseProcessingError if generateContent throws a non-Error object
- callGoogleAI > should throw underlying error if getGoogleAIClient throws
- AIResponseProcessingError > should correctly construct with only message
- AIResponseProcessingError > should correctly construct with message and original error

### `app/store/progressSlice.test.ts`

- ProgressSlice > should have correct initial state
- ProgressSlice > should set loading state during fetch
- ProgressSlice > should fetch and set user streak and level successfully
- ProgressSlice > should handle API error response (error property set)
- ProgressSlice > should handle thrown error during fetch
- ProgressSlice > should do nothing if user is not authenticated

### `lib/ai/exercise-generator.test.ts`

- AI Exercise Generation > generateAndValidateExercise > should successfully generate and validate an exercise
- AI Exercise Generation > generateAndValidateExercise > should re-throw error from generateExercisePrompt if prompt generation fails
- AI Exercise Generation > generateAndValidateExercise > should throw AIResponseProcessingError if callGoogleAI fails
- AI Exercise Generation > generateAndValidateExercise > should throw AIResponseProcessingError if callGoogleAI fails with a generic error
- AI Exercise Generation > generateAndValidateExercise > should throw AIResponseProcessingError if AI response fails Zod validation
- AI Exercise Generation > generateAndValidateExercise > should throw AIResponseProcessingError if AI response is 'null'
- AI Exercise Generation > generateAndValidateExercise > should throw AIResponseProcessingError if AI response is 'string'
- AI Exercise Generation > generateAndValidateExercise > should throw AIResponseProcessingError if AI response is 'number'
- AI Exercise Generation > generateAndValidateExercise > should throw AIResponseProcessingError for unexpected error during Zod validation
- AI Exercise Generation > generateAndValidateExercise > should handle successful validation when AI response topic is null
- AI Exercise Generation > generateAndValidateExercise > should handle successful validation when AI response topic is missing

### `lib/repositories/userRepository.test.ts`

- userRepository > upsertUserOnSignIn > should call db.prepare with the correct SQL and parameters for a new user
- userRepository > upsertUserOnSignIn > should handle null values for name, email, and image
- userRepository > upsertUserOnSignIn > should work with AdapterUser type
- userRepository > upsertUserOnSignIn > should log a warning and return if user id is missing
- userRepository > upsertUserOnSignIn > should log a warning and return if user email is missing
- userRepository > upsertUserOnSignIn > should catch and re-throw database errors
- userRepository > findUserByProvider > should return user id if user exists
- userRepository > findUserByProvider > should return null if user does not exist
- userRepository > findUserByProvider > should return null and log error if user record has invalid structure
- userRepository > findUserByProvider > should catch and re-throw database errors
- userRepository > findUserIdByProvider > should return user id if user is found
- userRepository > findUserIdByProvider > should return undefined if user is not found
- userRepository > findUserIdByProvider > should return undefined and log error if database query fails

### `app/components/TextGenerator/TextGeneratorContainer.test.tsx`

- TextGeneratorContainer > renders all static child components
- TextGeneratorContainer > shows QuizSkeleton when loading and no quizData
- TextGeneratorContainer > shows generated content when quizData and showContent
- TextGeneratorContainer > shows ProgressTracker when isAnswered
- TextGeneratorContainer > shows ProgressTracker when not content visible and not loading
- TextGeneratorContainer > fetches user progress when authenticated
- TextGeneratorContainer > Default Passage Language Logic > sets passageLanguage to "es" if UI language is "en" and current passageLanguage is not "es"
- TextGeneratorContainer > Default Passage Language Logic > does not change passageLanguage if UI language is "en" and current passageLanguage is already "es"
- TextGeneratorContainer > Default Passage Language Logic > sets passageLanguage to "en" if UI language is not "en" and current passageLanguage is not "en"
- TextGeneratorContainer > Default Passage Language Logic > does not change passageLanguage if UI language is not "en" and current passageLanguage is already "en"
- TextGeneratorContainer > Default Passage Language Logic > calls setPassageLanguage only once even with multiple relevant state changes in dependencies

### `app/components/TextGenerator/Generator.test.tsx`

- Generator Component > should render initial generate button when no quiz data exists
- Generator Component > should call fetchInitialPair when generate button is clicked and no quiz data exists
- Generator Component > should call loadNextQuiz when generate button is clicked after answering/feedback (authenticated)
- Generator Component > should call loadNextQuiz when generate button is clicked after answering (unauthenticated)
- Generator Component > should show feedback prompt when answered, authenticated, and feedback not submitted
- Generator Component > should call submitFeedback with true when good feedback button is clicked
- Generator Component > should call submitFeedback with false when bad feedback button is clicked
- Generator Component > should show skeleton when loading during feedback prompt phase
- Generator Component > should disable generate button when loading initially
- Generator Component > should disable feedback buttons when loading during feedback prompt phase

### `lib/config/authEnv.test.ts`

- authEnv module execution > should validate successfully and export env with minimal required variables
- authEnv module execution > should validate successfully and export env with all provider variables
- authEnv module execution > should throw an error if AUTH_SECRET is missing
- authEnv module execution > should throw an error if a provider ID is set without its secret
- authEnv module execution > should throw an error if a provider secret is set without its ID
- authEnv module execution > should handle ADMIN_EMAILS transformation correctly
- authEnv module execution > should handle empty ADMIN_EMAILS string
- authEnv module execution > should warn if NEXTAUTH_URL is not set in production
- authEnv module execution > should NOT warn if NEXTAUTH_URL is set in production
- authEnv module execution > should NOT throw errors during build phase, only log them
- authEnv module execution > should NOT throw errors during build phase even with valid AUTH_SECRET but other errors
- authEnv module execution > should validate successfully during build phase if all vars are correct

### `lib/progressUtils.test.ts`

- calculateAndUpdateProgress > should return updated progress when answer is correct and streak is below threshold
- calculateAndUpdateProgress > should level up when answer is correct and streak meets threshold
- calculateAndUpdateProgress > should reset streak to 0 but not level up when answer is correct, streak meets threshold, but already at max level (C2)
- calculateAndUpdateProgress > should reset streak when answer is incorrect
- calculateAndUpdateProgress > should initialize progress if none exists and update based on correct answer
- calculateAndUpdateProgress > should initialize progress if none exists and update based on incorrect answer
- calculateAndUpdateProgress > should handle language codes correctly (case-insensitivity and length)
- calculateAndUpdateProgress > should rethrow errors from getProgress
- calculateAndUpdateProgress > should rethrow errors from initializeProgress
- calculateAndUpdateProgress > should rethrow errors from updateProgress

### `lib/repositories/progressRepository.test.ts`

- progressRepository > should export STREAK_THRESHOLD_FOR_LEVEL_UP with the correct value
- progressRepository > getProgress > should return user progress when found and valid
- progressRepository > getProgress > should return null when user progress is not found
- progressRepository > getProgress > should return null and log error when data parsing fails
- progressRepository > getProgress > should handle null last_practiced date correctly
- progressRepository > getProgress > should throw an error when the database query fails
- progressRepository > initializeProgress > should insert initial progress and return the progress object
- progressRepository > initializeProgress > should throw an error when the database insertion fails
- progressRepository > updateProgress > should update user progress successfully
- progressRepository > updateProgress > should log a warning if no rows are updated
- progressRepository > updateProgress > should throw an error when the database update fails

### `lib/authOptions.test.ts`

- authOptions > should have the correct basic configuration
- authOptions > should configure all providers when credentials are provided
- authOptions > should only configure providers with available credentials and warn for missing ones
- authOptions > should assign the correct callback functions
- authOptions > should configure cookies correctly for non-production environment
- authOptions > should configure cookies correctly for production environment

### `lib/repositories/adminRepository.test.ts`

- Admin Repository Functions > getAllTableNames > should return a list of table names excluding sqlite\_ internal tables
- Admin Repository Functions > getAllTableNames > should throw an error if the database query fails
- Admin Repository Functions > getTableData > should fetch paginated data and total row count for a valid table
- Admin Repository Functions > getTableData > should use default ROWID ordering for unknown tables
- Admin Repository Functions > getTableData > should use specific ordering for the quiz table
- Admin Repository Functions > getTableData > should throw an error if the table name is not allowed
- Admin Repository Functions > getTableData > should throw an error if the database transaction fails
- Admin Repository Functions > getTableData > should handle count returning null or undefined

### `middleware.test.ts`

- Middleware > should return 200 OK for known bot user agents
- Middleware > should not redirect if path already has a locale (non-admin)
- Middleware > should not apply locale redirect logic to admin routes
- Middleware > should redirect non-admin users from admin routes
- Middleware > should redirect users without tokens from admin routes
- Middleware > should allow admin users access to admin routes
- Middleware > should allow regular users access to non-admin routes with locale
- Middleware > should handle root path with locale correctly
- Middleware > should redirect to preferred language if "Accept-Language" header is present
- Middleware > should redirect to default language if "Accept-Language" header is not suitable or missing
- Middleware > should handle complex "Accept-Language" headers with quality values
- Middleware > should ignore case for locale in path
- Middleware > should handle API routes and public files correctly (no redirection)

### `lib/repositories/rateLimitRepository.test.ts`

- RateLimitRepository > getRateLimit > should return rate limit data if found and valid
- RateLimitRepository > getRateLimit > should return null if no record is found
- RateLimitRepository > getRateLimit > should return null and log warning if data is invalid
- RateLimitRepository > getRateLimit > should throw error if database get fails
- RateLimitRepository > incrementRateLimit > should call run with the correct SQL and params
- RateLimitRepository > incrementRateLimit > should log warning if no rows were updated
- RateLimitRepository > incrementRateLimit > should throw error if database run fails
- RateLimitRepository > resetRateLimit > should call run with the correct SQL and params
- RateLimitRepository > resetRateLimit > should log warning if no rows were updated
- RateLimitRepository > resetRateLimit > should throw error if database run fails
- RateLimitRepository > createRateLimit > should call run with the correct SQL and params
- RateLimitRepository > createRateLimit > should log warning and not throw for UNIQUE constraint violation
- RateLimitRepository > createRateLimit > should throw error for other database run failures

### `lib/rate-limiter.test.ts`

- checkRateLimit > should allow the first request from an IP and create a record
- checkRateLimit > should allow subsequent requests within the limit and increment the count
- checkRateLimit > should deny requests when the limit is reached within the window
- checkRateLimit > should allow requests after the window expires and reset the count/window
- checkRateLimit > should return false (fail closed) if the database select operation fails
- checkRateLimit > should return false (fail closed) if the database insert operation fails
- checkRateLimit > should return false (fail closed) if the database update operation fails

### `lib/authUtils.test.ts`

- getDbUserIdFromSession > should return the user ID when a valid session with a matching user is provided
- getDbUserIdFromSession > should return null if the session is null
- getDbUserIdFromSession > should return null and log a warning if session user id is missing
- getDbUserIdFromSession > should return null and log a warning if session user provider is missing
- getDbUserIdFromSession > should return null and log a warning if the user is not found in the database
- getDbUserIdFromSession > should return null and log a warning if the database returns an object with id of wrong type
- getDbUserIdFromSession > should return null and log an error if the repository function throws an error

### `app/admin/actions.test.ts`

- Admin actions security > getTableNames authorization > should return false if user is not logged in
- Admin actions security > getTableNames authorization > should return false if user has no email
- Admin actions security > getTableNames authorization > should return false if user email is not in ADMIN_EMAILS
- Admin actions security > getTableNames authorization > should return true if user email is in ADMIN_EMAILS
- Admin actions security > getTableNames authorization > should handle empty ADMIN_EMAILS environment variable
- Admin actions security > getTableNames authorization > should handle errors from repository.getAllTableNames when it throws an Error instance
- Admin actions security > getTableNames authorization > should handle errors from repository.getAllTableNames when it throws a string
- Admin actions security > getTableData function > should return unauthorized error if user is not an admin
- Admin actions security > getTableData function > should return data if user is an admin
- Admin actions security > getTableData function > should handle errors from repository.getTableData when it throws an Error instance
- Admin actions security > getTableData function > should handle errors from repository.getTableData when it throws a string

### `app/admin/components/DataTable.test.tsx`

- DataTable > renders controls and body when not loading and no error
- DataTable > renders error message when error occurs
- DataTable > passes correct props to DataTableControls
- DataTable > passes correct props to DataTableBody
- DataTable > calls onRowClick when a row is clicked in DataTableBody
- DataTable > calculates minBodyHeight correctly

### `lib/repositories/feedbackRepository.test.ts`

- FeedbackRepository > createFeedback > should insert feedback with valid data and return lastInsertRowid
- FeedbackRepository > createFeedback > should handle optional fields being undefined
- FeedbackRepository > createFeedback > should throw validation error for invalid input data
- FeedbackRepository > createFeedback > should throw database error if insert fails
- FeedbackRepository > findFeedbackByUserIdAndQuizId > should return feedback data if found and transform 0/1 to booleans
- FeedbackRepository > findFeedbackByUserIdAndQuizId > should correctly handle null values for optional fields from DB
- FeedbackRepository > findFeedbackByUserIdAndQuizId > should return null if feedback is not found
- FeedbackRepository > findFeedbackByUserIdAndQuizId > should throw and log an error if database query fails

### `app/admin/page.test.tsx`

- AdminPage component > should show loading state while checking authentication
- AdminPage component > should show unauthorized message when user is not logged in
- AdminPage component > should show unauthorized message when user is not an admin
- AdminPage component > should load table names when user is an admin
- AdminPage component > should handle error when loading table names fails
- AdminPage component > should fetch and display table data when a table name is clicked
- AdminPage component > should display an error message if fetching table data fails

### `lib/domain/topics.test.ts`

- topics functions > topicsByLevel > should load topics from the mocked json
- topics functions > getTopicsForLevel > should return flattened topics for a valid level A1
- topics functions > getTopicsForLevel > should return flattened topics for a valid level A2
- topics functions > getTopicsForLevel > should handle categories with no topics for B1
- topics functions > getTopicsForLevel > should return an empty array for a level with categories but no topics (C0)
- topics functions > getTopicsForLevel > should throw an error for a level not in topicsByLevel (B2)
- topics functions > getTopicsForLevel > should throw an error for a completely invalid level string
- topics functions > getRandomTopicForLevel > should return a random topic from the level A1
- topics functions > getRandomTopicForLevel > should return a specific topic when Math.random is mocked (A2 - first topic)
- topics functions > getRandomTopicForLevel > should return a specific topic when Math.random is mocked (A2 - last topic)
- topics functions > getRandomTopicForLevel > should return "General knowledge" if the level C0 has no topics
- topics functions > getRandomTopicForLevel > should throw an error if getTopicsForLevel throws (e.g. invalid level B2)

### `app/admin/components/DataTableBody.test.tsx`

- DataTableBody > renders headers correctly
- DataTableBody > renders data rows and cells correctly
- DataTableBody > renders "No data found" when data array is empty
- DataTableBody > applies loading styles when isLoading is true
- DataTableBody > calls onRowClick with correct row data when a row is clicked
- DataTableBody > uses index as key when id is not present
- DataTableBody > renders a single header cell with non-breaking space when headers are empty
- DataTableBody > renders correctly when both headers and data are empty

### `app/[lang]/page.test.tsx`

- app/[lang]/page.tsx > generateMetadata > should return correct metadata
- app/[lang]/page.tsx > generateStaticParams > should generate params for all defined languages
- app/[lang]/page.tsx > Page Component > should call notFound for invalid language
- app/[lang]/page.tsx > Page Component > should initialize i18n and render PageClientContent for valid language
- app/[lang]/page.tsx > Page Component > should handle another valid language correctly
- app/[lang]/page.tsx > Page Component > should handle errors from initServerI18n

### `lib/domain/exercise.test.ts`

- ExerciseSchema > should parse a valid exercise successfully
- ExerciseSchema > should fail if paragraph is missing
- ExerciseSchema > should fail if paragraph is an empty string
- ExerciseSchema > should fail if topic is an empty string
- ExerciseSchema > should fail if question is missing
- ExerciseSchema > should fail if options.A is an empty string
- ExerciseSchema > should fail if correctAnswer is invalid
- ExerciseSchema > should fail if allExplanations.B is an empty string
- ExerciseSchema > should fail if relevantText is an empty string
- ExerciseSchema > should fail if options is not an object
- ExerciseSchema > should fail if a required option field (e.g., C) is missing
- CEFRLevelSchema in exercise.ts > should parse valid CEFR levels
- CEFRLevelSchema in exercise.ts > should reject invalid CEFR levels
- LanguageSchema in exercise.ts > should parse valid language codes
- LanguageSchema in exercise.ts > should reject invalid language codes

### `app/admin/components/DataTableControls.test.tsx`

- DataTableControls > renders refresh button on page 1 and no previous button
- DataTableControls > renders previous and next buttons on a middle page
- DataTableControls > disables next button on the last page
- DataTableControls > disables previous button on the first page (when not showing refresh)
- DataTableControls > disables buttons when loading
- DataTableControls > disables buttons when loading on a middle page
- DataTableControls > hides controls when there are no rows
- DataTableControls > hides controls when there is an error
- DataTableControls > calls onRefresh when refresh button is clicked
- DataTableControls > calls onPreviousPage when previous button is clicked
- DataTableControls > calls onNextPage when next button is clicked

### `app/[lang]/PageClientContent.test.tsx`

- PageClientContent > should render HomeContent
- PageClientContent > should load initial i18n resources for the initial language
- PageClientContent > should not load i18n resources if they already exist
- PageClientContent > should change i18n language if initialLanguage is different
- PageClientContent > should not change i18n language if initialLanguage is the same

### `app/admin/components/FormattedValueDisplay.test.tsx`

- FormattedValueDisplay > renders NULL for null value
- FormattedValueDisplay > renders NULL for undefined value
- FormattedValueDisplay > renders True for boolean true value
- FormattedValueDisplay > renders False for boolean false value
- FormattedValueDisplay > renders number as string
- FormattedValueDisplay > renders date string for created_at key
- FormattedValueDisplay > renders date string for updated_at key
- FormattedValueDisplay > renders original string if date parsing fails
- FormattedValueDisplay > renders formatted JSON for object string
- FormattedValueDisplay > renders formatted JSON for array string
- FormattedValueDisplay > renders original string if JSON parsing fails
- FormattedValueDisplay > renders formatted JSON for direct object value
- FormattedValueDisplay > renders plain string value
- FormattedValueDisplay > renders unsupported type message for unsupported values

### `app/components/TextGenerator/ProgressTracker.test.tsx`

- ProgressTracker > renders nothing if unauthenticated
- ProgressTracker > renders nothing if userStreak is null
- ProgressTracker > renders progress for A1 with streak 0
- ProgressTracker > renders progress for A2 with streak 1
- ProgressTracker > renders progress for B1 with streak 2
- ProgressTracker > renders progress for B2 with streak 3
- ProgressTracker > renders progress for C1 with streak 4
- ProgressTracker > renders progress for C2 with streak 4
- ProgressTracker > shows start streak message
- ProgressTracker > shows keep going streak message
- ProgressTracker > shows almost level up streak message

### `app/components/AuthButton.test.tsx`

- AuthButton > shows loading state
- AuthButton > shows sign in buttons (full)
- AuthButton > shows sign in buttons (icon-only)
- AuthButton > shows sign in buttons (short)
- AuthButton > calls signIn for each provider
- AuthButton > shows user info and menu for authenticated user
- AuthButton > shows admin link for admin user
- AuthButton > calls signOut on sign out button
- AuthButton > closes user menu when clicking outside

### `lib/domain/language.test.ts`

- LanguageSchema > should parse valid language codes
- LanguageSchema > should reject invalid language codes
- LANGUAGES record > should contain correct language names
- SPEECH_LANGUAGES record > should contain correct speech codes
- LearningLanguageSchema > should parse valid learning languages
- LearningLanguageSchema > should reject excluded learning languages
- LearningLanguageSchema > should reject other invalid language codes
- LEARNING_LANGUAGES record > should contain allowed learning languages
- LEARNING_LANGUAGES record > should not contain excluded learning languages
- RTL_LANGUAGES and getTextDirection > should correctly identify RTL languages
- RTL_LANGUAGES and getTextDirection > getTextDirection should return "rtl" for Hebrew
- RTL_LANGUAGES and getTextDirection > getTextDirection should return "ltr" for English
- RTL_LANGUAGES and getTextDirection > getTextDirection should return "ltr" for Spanish
- SUPPORTED_UI_LANG_CODES > should be an array of strings
- SUPPORTED_UI_LANG_CODES > should include common languages like en and es
- UILanguageSchema > should parse valid UI language codes
- UILanguageSchema > should reject invalid UI language codes
- UI_LANGUAGES record > should contain UI supported languages with correct names
- UI_LANGUAGES record > should only contain languages listed in SUPPORTED_UI_LANG_CODES

### `app/components/TextGenerator/LoginPrompt.test.tsx`

- LoginPrompt > renders login prompt when unauthenticated and showLoginPrompt is true
- LoginPrompt > does not render when not unauthenticated
- LoginPrompt > does not render when showLoginPrompt is false
- LoginPrompt > calls setShowLoginPrompt(false) when dismiss button is clicked

### `app/components/PWAInstall.test.tsx`

- PWAInstall > shows install button when beforeinstallprompt is fired
- PWAInstall > calls prompt and hides button after install
- PWAInstall > hides button when appinstalled is fired
- PWAInstall > does not show button in standalone mode
- PWAInstall > uses translation keys

### `app/components/TextGenerator/QuizSection.test.tsx`

- QuizSection > renders question and options
- QuizSection > calls handleAnswerSelect when an option is clicked
- QuizSection > disables options when answered
- QuizSection > shows correct explanation when answered and showExplanation
- QuizSection > shows relevant text when correct
- QuizSection > shows chosen incorrect explanation when incorrect
- QuizSection > returns null if no quizData or showQuestionSection is false

### `lib/ai/prompts/exercise-prompt.test.ts`

- generateExercisePrompt > should generate the correct prompt string based on parameters
- generateExercisePrompt > should correctly interpolate all parameters

### `lib/domain/ai.test.ts`

- ExerciseGenerationParamsSchema > should parse valid params successfully
- ExerciseGenerationParamsSchema > should fail if topic is missing
- ExerciseGenerationParamsSchema > should fail if passageLanguage is invalid
- ExerciseGenerationParamsSchema > should fail if questionLanguage is not a Language enum value
- ExerciseGenerationParamsSchema > should fail if level is not a CEFRLevel enum value
- ExerciseGenerationParamsSchema > should fail if passageLangName is not a string
- ExerciseGenerationParamsSchema > should fail if grammarGuidance is missing
- ExerciseGenerationParamsSchema > should fail if vocabularyGuidance is not a string
- ExerciseGenerationParamsSchema > should pass with empty string for topic
- ExerciseGenerationParamsSchema > should pass with empty string for grammarGuidance
- ExerciseGenerationParamsSchema > should pass with empty string for vocabularyGuidance

### `app/components/TextGenerator/useRenderParagraphWithWordHover.test.tsx`

- useRenderParagraphWithWordHover > renders words and whitespace correctly
- useRenderParagraphWithWordHover > passes language props to TranslatableWord
- useRenderParagraphWithWordHover > highlights the current word when speaking
- useRenderParagraphWithWordHover > does not highlight current word if not speaking
- useRenderParagraphWithWordHover > highlights relevant words in the range
- useRenderParagraphWithWordHover > handles empty paragraph

### `app/components/TextGenerator/ReadingPassage.test.tsx`

- ReadingPassage > renders passage title and text
- ReadingPassage > shows hover credits when in credits phase
- ReadingPassage > renders audio controls
- ReadingPassage > shows question will appear message when showQuestionSection is false
- ReadingPassage > renders nothing if quizData or generatedPassageLanguage is missing
- ReadingPassage > highlights relevant words when relevantTextRange is set

### `app/admin/components/RowDetailView.test.tsx`

- RowDetailView > renders with minimal props and displays row data
- RowDetailView > displays the table name in the title when provided
- RowDetailView > calls onClose when the close button is clicked
- RowDetailView > renders Delete button and calls onDelete when clicked
- RowDetailView > disables Delete button when isDeleting is true
- RowDetailView > renders Update button and calls onUpdate with rowData when clicked

### `app/admin/components/TableSelector.test.tsx`

- TableSelector > should render loading state
- TableSelector > should render error state
- TableSelector > should render no tables found message
- TableSelector > should render table name buttons
- TableSelector > should apply correct styles to selected and unselected buttons
- TableSelector > should call onSelectTable when a button is clicked

### `lib/utils/rendering.test.tsx`

- renderTableCellValue > should render null as italic NULL
- renderTableCellValue > should render undefined as italic NULL
- renderTableCellValue > should render short strings directly
- renderTableCellValue > should truncate long strings
- renderTableCellValue > should render booleans as strings
- renderTableCellValue > should render numbers as strings
- renderTableCellValue > should render simple objects as JSON strings
- renderTableCellValue > should truncate long JSON strings
- renderTableCellValue > should render function types with a fallback
- renderTableCellValue > should render symbol types with a fallback

### `lib/ai/client.test.ts`

- getGoogleAIClient > should throw an error if GOOGLE_AI_API_KEY is not set
- getGoogleAIClient > should initialize and return a GoogleGenAI client if GOOGLE_AI_API_KEY is set
- getGoogleAIClient > should return the same client instance on subsequent calls
- getGoogleAIClient > should handle errors during GoogleGenAI instantiation

### `app/store/textGeneratorStore.test.ts`

- textGeneratorStore > should initialize with all slices and their state
- textGeneratorStore > should update UI slice state
- textGeneratorStore > should update Settings slice state
- textGeneratorStore > should update Quiz slice state
- textGeneratorStore > should update Audio slice state
- textGeneratorStore > should update Progress slice state
- textGeneratorStore > should update Language slice state

### `app/store/languageSlice.test.ts`

- languageSlice > initializes with default language and languages
- languageSlice > setLanguage updates language and calls i18n
- languageSlice > setLanguage does not update if language is the same
- languageSlice > reloads page if i18n.changeLanguage throws
- languageSlice > router.push is called with new path if router is provided

### `app/actions/translate.test.ts`

- translateWordWithGoogle > returns null if word is missing
- translateWordWithGoogle > returns null if targetLang is missing
- translateWordWithGoogle > returns null if sourceLang is missing
- translateWordWithGoogle > returns null if GOOGLE_TRANSLATE_API_KEY is not configured
- translateWordWithGoogle > returns translation result on success
- translateWordWithGoogle > returns null if API error object
- translateWordWithGoogle > returns null if API response has no translations
- translateWordWithGoogle > returns null if fetch throws

### `app/[lang]/HomeContent.test.tsx`

- HomeContent Component > renders the main title
- HomeContent Component > renders the subtitle using mock translation
- HomeContent Component > renders the mocked child components
- HomeContent Component > renders the footer with mock translations and link
- HomeContent Component > renders the Ko-fi image link

### `app/store/settingsSlice.test.ts`

- settingsSlice > should have initial state
- settingsSlice > should set generatedPassageLanguage
- settingsSlice > should set generatedQuestionLanguage
- settingsSlice > should set cefrLevel
- settingsSlice > should set passageLanguage and reset generatedPassageLanguage

### `app/components/LanguageSelector.test.tsx`

- LanguageSelector > renders the current language
- LanguageSelector > opens and closes the dropdown
- LanguageSelector > shows all language options when open
- LanguageSelector > calls setLanguage and closes dropdown on option click
- LanguageSelector > closes dropdown when clicking outside

### `app/components/TextGenerator/LanguageSelector.test.tsx`

- LanguageSelector > renders language options
- LanguageSelector > calls setPassageLanguage on change
- LanguageSelector > displays CEFR level and label
- LanguageSelector > shows loading indicator when isProgressLoading is true

### `app/store/uiSlice.test.ts`

- uiSlice > should have initial state
- uiSlice > setShowLoginPrompt updates showLoginPrompt
- uiSlice > setShowContent updates showContent
- uiSlice > setShowQuestionSection updates showQuestionSection
- uiSlice > setShowExplanation updates showExplanation

### `app/components/TextGenerator/VoiceSelector.test.tsx`

- VoiceSelector > renders nothing if no voices
- VoiceSelector > renders single voice as label
- VoiceSelector > renders select for multiple voices
- VoiceSelector > calls setSelectedVoiceURI on change

### `app/layout.test.tsx`

- RootLayout > renders children
- RootLayout > should render the PWAInstall component
- RootLayout > renders children correctly

### `app/components/TextGenerator/PlayPauseButton.test.tsx`

- PlayPauseButton > shows play icon when not speaking
- PlayPauseButton > shows pause icon when speaking and not paused
- PlayPauseButton > shows play icon when paused
- PlayPauseButton > calls handlePlayPause on click

### `app/hooks/useLanguage.test.ts`

- useLanguage > returns language, setLanguage, and languages
- useLanguage > calls setLanguage with correct args

### `app/components/TextGenerator/AudioControls.test.tsx`

- AudioControls > renders nothing if speech is not supported
- AudioControls > renders nothing if no voices are available
- AudioControls > renders all controls when supported and voices available

### `app/actions/authUtils.test.ts`

- getAuthenticatedSessionUser > returns user when valid
- getAuthenticatedSessionUser > returns null when { user: { name: 'NoId' } }
- getAuthenticatedSessionUser > returns null when {}
- getAuthenticatedSessionUser > returns null when null
- getAuthenticatedSessionUser > throws if getServerSession throws

### `app/page.test.tsx`

- HomeContent > renders heading, subtitle, AuthButton, LanguageSelector, TextGenerator, and GitHub link

### `app/store/baseSlice.test.ts`

- baseSlice > should have initial state
- baseSlice > setLoading updates loading
- baseSlice > setError updates error

### `app/components/TextGenerator/ErrorDisplay.test.tsx`

- ErrorDisplay > renders nothing if there is no error
- ErrorDisplay > renders error message when error is present

### `app/not-found.test.tsx`

- NotFound component > renders translated "Page not found" message
- NotFound component > renders link to homepage with translated text
- NotFound component > uses i18n for translations

### `app/i18n.test.ts`

- initServerI18n > initializes i18next with correct options for a valid language
- initServerI18n > defaults to "en" if an invalid language is provided
- initServerI18n > loads namespaces correctly

### `app/i18n.client.test.ts`

- initClientI18n > initializes i18next with correct options
- initClientI18n > uses I18nextBrowserLanguageDetector and HttpApi backend
- initClientI18n > sets debug mode based on environment

### `app/error.test.tsx`

- Error > renders error message
- Error > calls reset on button click
- Error > shows fallback message if error message is missing

### `app/components/TextGenerator/VolumeSlider.test.tsx`

- VolumeSlider > renders the slider with correct value
- VolumeSlider > calls setVolumeLevel on change

### `app/components/TextGenerator/ErrorDisplay.i18n.test.tsx`

- ErrorDisplay (i18n) > renders with translated prefix

### `app/components/TextGenerator/QuizSkeleton.test.tsx`

- QuizSkeleton > renders the main container
- QuizSkeleton > renders the correct number of skeleton lines

### `app/[lang]/layout.test.tsx`

- RootLayout > should render children

### `app/api/auth/[...nextauth]/route.test.ts`

- Auth Route Handlers > should export GET and POST handlers
