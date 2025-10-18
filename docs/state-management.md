# State Management

This document outlines the state management strategy for the Comprehendo application.

## Overview

We use **Zustand** as our primary state management library. Zustand is a small, fast, and scalable bearbones state-management solution using simplified flux principles. It makes state management straightforward and integrates well with React.

To handle immutable updates more easily and write more readable mutation logic, we use the **Immer** middleware for Zustand. This allows us to write "mutating" logic within our state updaters, which Immer then translates into safe, immutable updates.

## Architecture: Single Store with Slices

We employ a **single global Zustand store** that is composed of multiple **slices**. Each slice is responsible for a specific domain of the application's state and logic.

**Decision Rationale:**

- **Simplicity of Cross-Slice Interactions:** A single store makes it easy for different parts of the state to interact with each other. Actions in one slice can easily `get()` state from or call actions in other slices.
- **Centralized State:** Having one source of truth simplifies debugging and understanding the overall application state.
- **Middleware Application:** Middleware (like `immer` and `persist` for localStorage) is applied once to the entire store.
- **Type Safety:** A combined state type (e.g., `TextGeneratorState`) provides a clear, typed overview of the entire application's state.

While separate stores could offer more decoupling, the current level of interaction between our state domains (e.g., quiz logic needing language settings and UI state) makes the single-store-with-slices approach more pragmatic and manageable.

## Store Structure

The main store is defined in `app/store/textGeneratorStore.ts`. It combines various slices using their respective creator functions:

```typescript
// Example from app/store/textGeneratorStore.ts
export const useTextGeneratorStore = create<TextGeneratorState>()(
  persist(
    immer((...args) => ({
      ...createUISlice(...args),
      ...createSettingsSlice(...args),
      ...createQuizSlice(...args),
      // ... and so on for other slices
    })),
    {
      name: 'text-generator-store',
      // ... persistence configuration ...
    }
  )
);
```

Each `create[SliceName]Slice` function is a Zustand `StateCreator` that defines its piece of the state and associated actions.

## Slice Descriptions

- **`baseSlice.ts`**:
  - **Responsibility:** Provides common state properties and setters for loading status (`loading`), error messages (`error`), and error visibility (`showError`).
  - It's not used directly but composed into other slices that require these base functionalities.
- **`uiSlice.ts`**:
  - **Responsibility:** Manages general UI state, such as visibility of login prompts, main content display (`showContent`), question sections (`showQuestionSection`), and explanations (`showExplanation`).
  - Composes `baseSlice` for its own loading/error states if needed for UI-specific async operations (though typically loading/error for data fetching resides in the data-specific slice).
- **`settingsSlice.ts`**:
  - **Responsibility:** Manages user-configurable settings like passage language, target CEFR level (`cefrLevel`), and generation languages.
  - Handles actions that might impact multiple parts of the application when a setting changes (e.g., resetting quiz state when language changes).
- **`quizSlice.ts`**:
  - **Responsibility:** Manages all state related to the current quiz, including the quiz data itself, user's selected answer, feedback, fetching new quizzes, and interactions during a quiz session.
  - Relies on `uiSlice` for controlling visibility of quiz-related UI elements.
  - Relies on `settingsSlice` for CEFR level and language settings.
  - Relies on `audioSlice` for speech-related actions.
- **`audioSlice.ts`**:
  - **Responsibility:** Manages all aspects of text-to-speech functionality, including playback state (speaking, paused), volume, available voices, selected voice, and speech synthesis utterance management. Also handles word translation caching.
- **`languageSlice.ts`**:
  - **Responsibility:** Manages the application's UI display language (i18n) and related settings.
- **`progressSlice.ts`**:
  - **Responsibility:** Manages user progress tracking, such as user streak and fetching overall progress data. Updates the user's `cefrLevel` (in `settingsSlice`) based on progress.

## Guidelines for Adding New State or Actions

1.  **Identify the Correct Slice:**
    - Before adding new state or actions, determine which existing slice is most relevant to the domain of that state.
    - For example, state related to quiz interaction goes into `quizSlice`; state for general UI visibility goes into `uiSlice`.
2.  **Modifying Slice State:**
    - Within a slice's action, use the `set` function provided by Zustand. Thanks to Immer, you can write "mutative" logic:
      ```typescript
      // Inside a slice creator
      someAction: (newValue) => {
        set((state) => {
          state.someProperty = newValue; // Immer handles immutable update
        });
      },
      ```
3.  **Accessing Other Slices' State or Actions:**
    - Use the `get()` function (the second argument to the slice creator `(set, get) => ({...})`) to access the entire store's state or other actions:

      ```typescript
      // Inside a slice creator
      anotherAction: () => {
        const currentPassageLanguage = get().passageLanguage; // Reading from settingsSlice
        const isLoading = get().loading; // Reading from baseSlice (composed)

        if (!isLoading) {
          get().someActionInAnotherSlice(currentPassageLanguage); // Calling another slice's action
        }
      };
      ```

4.  **Setting Other Slices' State:**
    - **Avoid direct mutation:** Do NOT directly set state for another slice like `set(state => { state.otherSliceProperty = value; })`. This breaks encapsulation.
    - **Call setters/actions:** Instead, call an appropriate action/setter from the target slice using `get().targetSetter(value)`. This was a key part of our recent refactor.
5.  **Async Actions:**
    - Perform asynchronous operations (e.g., API calls) within your action, then use `set` to update the state based on the result. Manage loading and error states (typically from `baseSlice`) accordingly.
      ```typescript
      fetchData: async () => {
        set(state => { state.loading = true; state.error = null; });
        try {
          const data = await apiCall();
          set(state => { state.data = data; state.loading = false; });
          get().setShowContent(true); // Example: show content after data is loaded
        } catch (e) {
          const error = e instanceof Error ? e.message : 'Unknown error';
          set(state => { state.error = error; state.loading = false; });
          get().setShowContent(false); // Example: hide content on error
        }
      },
      ```
6.  **Keep Slices Focused:** Try to keep each slice focused on its specific domain to maintain clarity and separation of concerns.
7.  **Type Everything:** Ensure all state properties and action payloads/return types are clearly typed. The combined `TextGeneratorState` helps ensure overall type safety.
