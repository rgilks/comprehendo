# Introduction

Comprehendo is an AI-powered language learning application designed to help users improve their language skills through interactive exercises and personalized feedback.

The purpose of this document is to provide a comprehensive overview of Comprehendo's software architecture. It will detail the various components, their interactions, and the technologies used to build and run the application. This document is intended for developers, architects, and anyone interested in understanding the technical design of Comprehendo.

## Core Technologies

This section outlines the primary technologies used in Comprehendo and why they were chosen.

- **Next.js (App Router):** [https://nextjs.org/docs](https://nextjs.org/docs)
  - A React framework that enables features like server-side rendering and static site generation, beneficial for performance and SEO. The App Router provides a robust structure for modern web applications, making it ideal for Comprehendo's dynamic content and user interactions.
- **TypeScript:** [https://www.typescriptlang.org/docs/](https://www.typescriptlang.org/docs/)
  - A superset of JavaScript that adds static typing. This helps in catching errors early during development and improving code maintainability, which is crucial for a growing application like Comprehendo.
- **Tailwind CSS:** [https://tailwindcss.com/docs](https://tailwindcss.com/docs)
  - A utility-first CSS framework that allows for rapid UI development. Its customizable nature and low-level primitives are perfect for building Comprehendo's unique and responsive user interface.
- **NextAuth.js:** [https://next-auth.js.org/getting-started/introduction](https://next-auth.js.org/getting-started/introduction)
  - An authentication library for Next.js applications. It simplifies the process of adding authentication, supporting various providers, which is essential for managing user accounts and progress in Comprehendo.
- **Zustand:** [https://docs.pmnd.rs/zustand/getting-started/introduction](https://docs.pmnd.rs/zustand/getting-started/introduction)
  - A small, fast, and scalable state management solution. Its simplicity and minimal boilerplate make it a great choice for managing global state in Comprehendo, such as user preferences and UI state.
- **Google AI SDK (Gemini):** [https://ai.google.dev/docs](https://ai.google.dev/docs)
  - Provides access to Google's powerful generative AI models. This is fundamental to Comprehendo's core functionality of generating personalized language learning exercises and providing AI-driven feedback.
- **SQLite (`better-sqlite3`):** [https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md)
  - A lightweight, file-based SQL database engine. `better-sqlite3` offers a synchronous API for Node.js, making it simple and efficient for storing user data, progress, and application content in Comprehendo, especially suitable for rapid prototyping and deployment.
- **i18next:** [https://www.i18next.com/overview/getting-started](https://www.i18next.com/overview/getting-started)
  - An internationalization framework for JavaScript. It allows Comprehendo to support multiple languages, making the application accessible to a global audience.
- **Serwist:** [https://serwist.pages.dev/docs/next/getting-started](https://serwist.pages.dev/docs/next/getting-started)
  - A set of libraries for integrating Service Workers into modern web applications, particularly Next.js. This enables offline capabilities and improved performance through caching, enhancing the user experience for Comprehendo users with intermittent connectivity.

## Frontend Architecture

The frontend of Comprehendo is built using Next.js and React, focusing on a modern, responsive, and internationalized user experience.

- **Next.js App Router:** [https://nextjs.org/docs/app](https://nextjs.org/docs/app)
  - Comprehendo utilizes the Next.js App Router for its routing and layout capabilities. The primary application code resides within the `app/` directory.
  - Each route segment is defined by a folder. `layout.tsx` files define shared UI shells for route segments and their children. For instance, `app/[lang]/layout.tsx` establishes the main layout for language-specific pages.
  - `page.tsx` files define the unique UI for a route segment. A key example is `app/[lang]/page.tsx`, which serves as the entry point for displaying content in the selected language, leveraging dynamic segments (`[lang]`) to handle different languages.
- **UI Components:**
  - Reusable UI components are organized within the `app/components/` directory. This includes general-purpose components like buttons and modals, as well as feature-specific components such as those found in `app/components/TextGenerator/`. This modular approach promotes code reuse and maintainability.
- **Styling (Tailwind CSS):** [https://tailwindcss.com/docs](https://tailwindcss.com/docs)
  - Styling is primarily handled by Tailwind CSS, a utility-first CSS framework. This allows for rapid UI development by composing utility classes directly in the JSX markup, as seen in `app/globals.css` for base styles and throughout the component files.
- **Client-Side State Management (Zustand):** [https://docs.pmnd.rs/zustand/getting-started/introduction](https://docs.pmnd.rs/zustand/getting-started/introduction)
  - Global client-side state (e.g., UI state, user preferences, audio player state) is managed using Zustand. Store definitions and hooks are located in `app/store/`, such as `app/store/textGeneratorStore.ts`. Zustand is chosen for its simplicity, small bundle size, and ease of use with React hooks.
- **Internationalization (i18n):**
  - Comprehendo supports multiple languages using `i18next` ([https://www.i18next.com/overview/getting-started](https://www.i18next.com/overview/getting-started)) and `react-i18next` ([https://react.i18next.com/getting-started](https://react.i18next.com/getting-started)).
  - Language translation files (JSON format) are stored in `public/locales/{lang}/common.json` (e.g., `public/locales/en/common.json` for English).
  - The `middleware.ts` file at the root of the `app` directory (or project root, depending on Next.js version conventions) is responsible for detecting the user's preferred language (from the path, cookies, or browser settings) and redirecting to the appropriate language-specific URL (e.g., `/en/...` or `/es/...`). It also ensures that a supported language is always present in the URL.
  - Client-side language context and translation functions are provided via `app/i18n.client.ts`. Server-side translation setup is handled in `app/i18n.ts`.

## Backend Architecture (within Next.js)

Comprehendo leverages Next.js's backend capabilities to handle server-side logic, data processing, and authentication.

- **Server Actions:** [https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
  - Server Actions are used for mutating data and executing server-side logic directly from React components (both Server Components and Client Components). This simplifies the interaction between frontend and backend, especially for form submissions and data updates.
  - These actions are defined in files like `app/actions/exercise.ts`, which might contain functions to generate new exercises, save user progress on an exercise, or fetch exercise-related data. By co-locating server logic with the relevant domain, Server Actions promote a more organized and maintainable codebase.
- **API Routes (Route Handlers):** [https://nextjs.org/docs/app/building-your-application/routing/route-handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
  - API Routes (now often referred to as Route Handlers in the App Router) provide a way to create custom backend request handlers. While Server Actions are preferred for most data mutations initiated from the UI, API Routes are useful for specific backend endpoints.
  - In Comprehendo, a critical use case for API Routes is authentication via NextAuth.js. The route `app/api/auth/[...nextauth]/route.ts` (or `app/api/auth/[...nextauth].ts` depending on the Next.js version and project structure) handles all authentication-related requests (e.g., sign-in, sign-out, session management, OAuth callbacks) processed by NextAuth.js. Other API routes might be used for webhooks or other specific server-to-server communication.
- **Authentication (NextAuth.js):** [https://next-auth.js.org/getting-started/introduction](https://next-auth.js.org/getting-started/introduction)
  - User authentication and session management are handled by NextAuth.js. It provides a flexible and secure way to integrate various authentication providers (e.g., Google, GitHub, email/password).
  - The core configuration for NextAuth.js is located in `app/lib/authOptions.ts`. This file defines the chosen authentication providers, session strategies (e.g., JWT, database sessions), callbacks for customizing behavior (like saving user data to the database on sign-up), and adapter settings if using a database to persist users and sessions.
  - NextAuth.js automatically creates API endpoints (as mentioned above) to manage the authentication lifecycle. It securely handles user sessions, typically using cookies, and provides session information to both client-side components (via `useSession` hook or `getSession` function) and server-side code (e.g., in Server Components, Server Actions, or API Routes), allowing Comprehendo to protect routes and personalize content based on the authenticated user.

## AI Integration

Comprehendo's core language learning features are powered by generative AI through the Google AI SDK.

- **Google AI SDK:** [https://ai.google.dev/docs/nodejs_quickstart](https://ai.google.dev/docs/nodejs_quickstart)
  - The application utilizes the `@google/generative-ai` npm package to interact with Google's AI models, likely including models from the Gemini family. This SDK provides the necessary tools to send prompts and receive generated content, forming the backbone of the AI-driven features.
- **AI Client Setup:**
  - The AI client is initialized in `app/lib/ai/client.ts`. This module is responsible for configuring the `GoogleGenerativeAI` instance with the necessary API key.
  - The API key is typically stored in an environment variable named `GOOGLE_AI_API_KEY` (or `PALM_API_KEY` for older Palm models, if used). Proper configuration of this key is crucial for the AI functionalities to work. The client setup might also include default model parameters or error handling mechanisms.
- **Exercise Generation:**
  - The primary logic for generating language learning exercises resides in `app/lib/ai/exercise-generator.ts`. This module takes parameters such as the target language, user's proficiency level, desired topic, and type of exercise.
  - It then constructs specific prompts, sends them to the Google AI model via the initialized client, and processes the model's response to format it into a usable exercise structure (e.g., a reading passage with questions, a vocabulary quiz).
  - This exercise generation process is typically invoked by Server Actions, such as those defined in `app/actions/exercise.ts`. For example, when a user requests a new lesson, a Server Action calls the `exercise-generator` with the relevant parameters, and the resulting exercise is then passed back to the frontend for display. The prompts used for generation are located in `app/lib/ai/prompts/`.

## Data Persistence

Comprehendo uses SQLite for its data storage needs, accessed via the `better-sqlite3` library.

- **Database Choice (SQLite with `better-sqlite3`):** [https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md)
  - SQLite is a lightweight, file-based database that is embedded within the application. This simplifies deployment and setup, as it doesn't require a separate database server process.
  - `better-sqlite3` provides a synchronous, direct API to SQLite, which is well-suited for the Next.js server-side environment.
  - Benefits for Comprehendo include ease of development, minimal configuration, and sufficient performance for the application's current scale and nature (e.g., individual user data, content storage).
- **Schema Definition and Initialization:**
  - The database schema, including table creation and initial data seeding, is defined and managed in `app/repo/db.ts`. This file contains the SQL statements to set up the database structure when the application starts or when the database file is first created.
  - Key tables include:
    - `quiz`: Stores the AI-generated exercises and quizzes, including passages, questions, and answers.
    - `users`: Manages user profiles, including authentication details (often linked via NextAuth.js) and preferences.
    - `user_language_progress`: Tracks each user's progress through different languages and topics, storing scores and completion status.
    - `question_feedback`: Collects user feedback on specific questions or exercises, which can be used for improving content quality.
    - `rate_limits`: Stores records to manage and enforce rate limiting for certain actions or API calls to prevent abuse and ensure fair usage.
- **Repository Pattern:**
  - Data access logic is abstracted using a repository pattern. Each main database table or domain entity has an associated repository file within the `app/repo/` directory.
  - Examples include:
    - `app/repo/quizRepo.ts`: Handles all database operations related to quizzes (creating, fetching, updating).
    - `app/repo/userRepo.ts`: Manages user data operations (creating users, fetching profiles, updating settings).
    - `app/repo/progressRepo.ts`: Interacts with the `user_language_progress` table.
    - `app/repo/feedbackRepo.ts`: Manages storage and retrieval of user feedback.
    - `app/repo/rateLimitRepo.ts`: Handles database interactions for rate limiting.
  - These repository modules encapsulate the SQL queries and data transformation logic. They expose a clean, typed API to the rest of the backend, primarily Server Actions (e.g., `app/actions/progress.ts` would use `progressRepo.ts`). This separation of concerns makes the codebase more modular, easier to test, and simplifies database interactions for the application logic.

## Middleware (`middleware.ts`)

Comprehendo utilizes Next.js Middleware, defined in the `middleware.ts` file (typically at the root of the project or inside the `app` directory), to process requests before they reach page or route handlers. More information on Next.js middleware can be found [here](https://nextjs.org/docs/app/building-your-application/routing/middleware).

The middleware in this application performs several key functions:

- **Bot Filtering:**
  - It inspects the `User-Agent` header of incoming requests. If the user agent matches a predefined list of known bot signatures (e.g., common web crawlers or malicious bots), the middleware can block the request or return a specific response, preventing these bots from accessing the application. This helps in reducing server load and protecting against unwanted traffic.
- **Internationalization (i18n) Locale Redirection:**
  - The middleware plays a crucial role in the internationalization strategy. It checks if the requested path already includes a supported language locale (e.g., `/en/some-page`, `/es/another-page`).
  - If a locale is missing from the path, the middleware determines the appropriate locale to redirect to. This decision can be based on:
    - A locale cookie (e.g., `NEXT_LOCALE`) set during a previous visit.
    - The `Accept-Language` header sent by the browser.
    - A default fallback locale defined in the application's i18n configuration (`app/domain/i18nConfig.ts`).
  - Once the locale is determined, the middleware redirects the user to the same path prefixed with the locale (e.g., from `/some-page` to `/en/some-page`). This ensures a consistent, localized experience.
- **Admin Route Protection:**
  - The middleware protects routes under the `/admin` path. It integrates with NextAuth.js to check the user's session.
  - When a request is made to an admin route, the middleware verifies if the user is authenticated and if their session token contains an "admin" role or a similar claim.
  - If the user is not authenticated or does not possess the admin role, they are redirected away from the `/admin` section, typically to the login page or a "not authorized" page. This ensures that sensitive administrative functionalities are accessible only to authorized personnel.

The `matcher` configuration within `middleware.ts` is used to specify an array of path patterns that the middleware should apply to. This allows for fine-grained control over which requests are processed by the middleware logic, optimizing performance by excluding paths that don't require these checks (e.g., static assets, API routes not needing protection or i18n).

## Deployment and Progressive Web App (PWA)

This section details how Comprehendo is deployed and how its Progressive Web App features are enabled.

- **Deployment:**
  - The application is containerized using Docker. The `Dockerfile` in the project root defines the image build process, ensuring a consistent environment for development and production. [Docker Documentation](https://docs.docker.com/)
  - Comprehendo is configured for deployment on Fly.io. The `fly.toml` file specifies the deployment settings for the Fly.io platform.
  - Continuous Integration and Continuous Deployment (CI/CD) for Fly.io is managed via a GitHub Actions workflow defined in `.github/workflows/fly.yml`. This automates the build and deployment process upon pushes or merges to the main branch. [Fly.io Documentation](https://fly.io/docs/)
- **Progressive Web App (PWA):**
  - Comprehendo is enhanced with PWA capabilities using `@serwist/next`, a library that simplifies PWA integration with Next.js applications. This allows users to "install" the application on their devices for a more native-like experience. [Serwist for Next.js Documentation](https://serwist.pages.dev/docs/next/getting-started)
  - A service worker, configured via `next.config.js` and located at `app/sw.ts`, is crucial for PWA functionality. It handles caching of static assets and application shells, enabling offline access to previously visited content and improving performance by serving cached resources.
  - The Web App Manifest, located at `public/manifest.json`, provides metadata about the application, such as its name, icons, start URL, and display mode. This information is used by browsers when a user adds the application to their home screen. [Web App Manifest Documentation](https://developer.mozilla.org/en-US/docs/Web/Manifest)

## Application Flow Example: Generating and Attempting an Exercise

This section describes a typical flow within Comprehendo, from a user requesting an exercise to submitting their answers.

1.  **User Input (Frontend):**
    - The user, interacting with a client component (likely within `app/components/TextGenerator/`), selects their desired target language, CEFR proficiency level, and a specific topic. Alternatively, they might request a random topic.
2.  **Trigger Server Action:**
    - The client component takes these parameters and invokes a Server Action, for example, `generateExerciseResponse`, which is defined in `app/actions/exercise.ts`.
3.  **Server Action Processing (Backend):**
    - The `generateExerciseResponse` Server Action first validates the incoming parameters (language, level, topic).
    - It then checks if the user is subject to rate limiting for exercise generation (using logic likely involving `app/repo/rateLimitRepo.ts`).
    - The action may then attempt to retrieve a relevant, previously generated exercise from the SQLite database cache via `app/repo/quizRepo.ts` to save on AI API calls and improve response time.
4.  **Conditional AI Generation Call:**
    - If no suitable cached exercise is found, or if the caching strategy determines a fresh exercise is needed (e.g., based on time or user request), the Server Action proceeds to call the AI exercise generation logic located in `app/lib/ai/exercise-generator.ts`.
5.  **Prompt Crafting:**
    - The `exercise-generator` module constructs a detailed prompt for the AI. This prompt includes:
      - The selected target language, CEFR level, and topic.
      - Specific grammar structures and vocabulary themes appropriate for the level, potentially drawing from `app/domain/language-guidance.ts` (which might contain CEFR-specific linguistic targets) and `app/domain/topics.ts` (for topic-related vocabulary).
6.  **AI API Interaction:**
    - The crafted prompt is sent to the Google AI API (e.g., Gemini) using the client configured in `app/lib/ai/client.ts`.
7.  **AI Response Reception:**
    - The Google AI model processes the prompt and returns a response containing a generated reading passage and a set of comprehension questions.
8.  **Validation and Formatting:**
    - The `exercise-generator` receives the AI's raw response. It then validates this response against predefined Zod schemas (from `app/domain/schemas.ts`) to ensure the data structure is correct and the content is appropriate (e.g., checking for required fields, text length, or potential harmful content if filters are applied). The data is then formatted into the application's standard exercise structure.
9.  **Cache New Exercise:**
    - The newly validated and formatted exercise is saved to the SQLite database using `app/repo/quizRepo.ts`, making it available for future requests.
10. **Return to Client:**
    - The Server Action (`generateExerciseResponse`) returns the exercise data (or an error object if any step failed) as a Promise to the calling client component.
11. **Frontend Display:**
    - The client component receives the exercise data. It then uses various components from `app/components/TextGenerator/` (e.g., `ReadingPassage.tsx`, `QuizSection.tsx`) to render the passage and questions for the user.
12. **User Interaction and Submission:**
    - The user reads the passage and attempts the questions.
    - Upon submitting their answers, another Server Action (e.g., a function in `app/actions/progress.ts`) might be triggered. This action would record the user's performance (e.g., score, completed questions) in the `user_language_progress` table via `app/repo/progressRepo.ts`.
    - Optionally, if the user provides feedback on a question or the exercise, this feedback could be saved to the `question_feedback` table via `app/repo/feedbackRepo.ts`.

## Key Concepts and Design Decisions

This section outlines some of the core architectural patterns and key technology choices that shape Comprehendo.

- **Architectural Patterns:**
  - **Next.js App Router Model:** Comprehendo leverages the Next.js App Router, which employs React Server Components (RSC) by default for most components. This means components are primarily rendered on the server, reducing the amount of JavaScript sent to the client, leading to faster initial page loads and improved performance. Interactive UI elements that require browser-side JavaScript are explicitly designated as Client Components (using the `"use client"` directive). This hybrid approach optimizes for both server rendering benefits and rich client-side interactivity where needed.
    - Reference: [Next.js Server and Client Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components)
  - **Server Actions:** As mentioned previously, Server Actions are a key pattern. They allow client components to directly invoke server-side functions as if they were local. This simplifies data mutations and backend logic by co-locating these operations with the UI elements that trigger them, reducing the need for manually creating and managing separate API endpoints for many common operations.
- **Key Design Choices:**
  - **Next.js (App Router):** Next.js was chosen as the foundational framework due to its comprehensive feature set for building full-stack applications. The App Router, in particular, offers robust routing, excellent performance optimizations (Server-Side Rendering, Static Site Generation, and RSCs), and a powerful data fetching model. Its large ecosystem and strong community support also contribute to its suitability for a project like Comprehendo.
  - **SQLite (`better-sqlite3`):** For data persistence, SQLite (via `better-sqlite3`) was selected primarily for its simplicity and ease of use. Being an embedded database, it requires no separate server setup, which simplifies development, testing, and deployment, especially for smaller to medium-scale applications. The performance is adequate for Comprehendo's current data needs, which include storing user data, generated content, and progress.
  - **Zustand:** Zustand was chosen for client-side state management because of its lightweight nature and minimalistic API. It provides a simple and effective way to manage global state with React hooks without the complexity and boilerplate often associated with libraries like Redux. This makes it a good fit for managing UI state, user preferences, and other client-specific data in Comprehendo.
    - Reference: [Zustand](https://docs.pmnd.rs/zustand/getting-started/introduction)
  - **Google AI SDK (Gemini):** The decision to use the Google AI SDK (specifically for Gemini models) was driven by the need for powerful and flexible generative AI capabilities. The SDK offers a straightforward way to integrate these models into a Node.js backend. The available models are well-suited for Comprehendo's core tasks of generating educational text and comprehension exercises.

## Future Improvements

This section suggests potential areas for architectural enhancement as Comprehendo evolves.

- **Database Scaling:**
  - As user load and data volume grow, migrating from SQLite to a more scalable database solution like PostgreSQL or a managed cloud database (e.g., AWS RDS, Google Cloud SQL, Supabase) may become necessary. This would provide better concurrency, fault tolerance, and overall performance for a larger user base.
- **Microservices:**
  - For enhanced scalability and maintainability, specific, computationally intensive, or independently deployable features could be extracted into microservices. Potential candidates include:
    - **AI Processing Service:** A dedicated service for managing interactions with the Google AI SDK, handling prompt engineering, and processing AI-generated content. This could be scaled independently based on AI workload.
    - **Analytics Service:** A separate service for collecting and processing user interaction data for learning analytics, which could operate asynchronously without impacting core application performance.
- **Advanced AI Model Integration:**
  - **Fine-tuning:** Investigate fine-tuning AI models on Comprehendo's specific data (e.g., high-quality exercises, user feedback) to create models that are more tailored to the application's language learning context and can generate even more relevant and effective content.
  - **Model Exploration:** Continuously evaluate and explore different or newer AI model providers and architectures as they become available to leverage the latest advancements in AI.
  - **Prompt Engineering:** Implement more sophisticated prompt engineering and management strategies, possibly including a dedicated system for versioning, testing, and optimizing prompts for various scenarios and languages.
- **Caching Strategies:**
  - With potential multi-instance deployments in the future, implementing a distributed cache (e.g., Redis) would be beneficial. This could be used for:
    - **Session Management:** Storing NextAuth.js sessions in a distributed cache to maintain user sessions across multiple server instances.
    - **API Response Caching:** Caching responses from internal or external APIs to reduce latency and load on backend services.
    - **Database Query Caching:** Caching results of frequently accessed database queries to alleviate database load.
- **Enhanced Observability:**
  - Integrate more comprehensive observability tools to gain deeper insights into system behavior and quickly diagnose issues in a production environment. This could include:
    - **Distributed Tracing:** Tools like OpenTelemetry to trace requests across different services (especially if microservices are introduced).
    - **Advanced Logging:** Structured logging solutions that can be easily searched and analyzed.
    - **Monitoring and Alerting:** Platforms like Sentry or Datadog for real-time error tracking, performance monitoring, and alerting on critical issues.
- **Real-time Features:**
  - For future interactive features, such as collaborative learning exercises or live feedback mechanisms, consider incorporating technologies like WebSockets. This would enable bidirectional communication between the client and server for a more dynamic user experience.
