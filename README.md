# Comprehendo

A multi-language reading comprehension practice tool powered by Next.js, OpenAI, and Google Gemini.

[![CI/CD](https://github.com/rgilks/comprehendo/actions/workflows/fly.yml/badge.svg)](https://github.com/rgilks/comprehendo/actions/workflows/fly.yml)

![Comprehendo Screenshot](public/screenshot.png)

## Overview

Comprehendo is an AI-powered language learning application designed to help users improve their reading comprehension skills in multiple languages. The application generates customized reading passages based on the user's selected language and proficiency level (CEFR), then provides multiple-choice questions to test understanding. Word translations are powered by the MyMemory Translation API (if integrated, otherwise specify).

## Features

- **Multi-language Support**: Practice reading comprehension in English, Italian, Spanish, French, or German (confirm languages).
- **CEFR Level Selection**: Choose from six proficiency levels (A1-C2) to match your current language skills.
- **AI-Generated Content**: Fresh, unique reading passages generated for each practice session.
- **Multiple AI Model Support**: Switch between OpenAI's GPT-3.5 Turbo and Google's Gemini 2.0 Flash-Lite via environment variables.
- **Interactive Quiz Format**: Answer multiple-choice questions and receive immediate feedback.
- **Detailed Explanations**: Learn why answers are correct or incorrect with thorough explanations.
- **Text Highlighting**: See the relevant portion of text highlighted after answering.
- **Word Translation**: Hover over any word to see its translation in English (verify implementation).
- **Text-to-Speech**: Listen to passages and individual words with adjustable volume (verify implementation).
- **User Authentication**: Secure login via GitHub, Google, and Discord OAuth.
- **Data Persistence**: Store user preferences and usage statistics in an SQLite database.
- **Responsive Design**: Optimized for both desktop and mobile devices.
- **Modern UI**: Clean, intuitive interface with smooth animations and visual feedback using Tailwind CSS.
- **Cost-Control System**: IP-based rate limiting and database caching to manage API costs.
- **Robust Validation**: Uses Zod for request validation on API routes and environment variables.
- **Smooth Loading Experience**: Enhanced loading indicators and transitions.
- **Continuous Deployment**: Automatic deployment to Fly.io via GitHub Actions when code is pushed to the `main` branch.
- **Admin Panel**: A secure area for administrators to view application data (users, quizzes, feedback).
- **Internationalization (i18n)**: Full i18n support for UI elements using `i18next`.
- **PWA Support**: Progressive Web App features for mobile installation using `@ducanh2912/next-pwa`.
- **Sentry Integration**: Real-time error tracking and performance monitoring.
- **State Management**: Uses `zustand` for lightweight global state management.
- **Database Caching**: SQLite database for caching generated exercises.
- **Testing**:
  - Unit and integration tests with Jest & React Testing Library.
  - End-to-end tests with Playwright.
- **Code Quality**:
  - ESLint and Prettier for linting and formatting.
  * Husky and lint-staged for Git hooks (pre-commit/pre-push checks).

* **State Diagram**: Visual representation of the text generation process. [View State Diagram](docs/text_generator_state_diagram.md)

## Technology Stack

- **Next.js**: Latest version using App Router (`package.json` likely has exact version)
- **React**: Latest major version (`package.json` likely has exact version)
- **Tailwind CSS**: Utility-first CSS framework
- **TypeScript**: Strong typing for code quality
- **next-auth**: Authentication (GitHub, Google, Discord)
- **OpenAI SDK**: GPT-3.5 Turbo integration
- **Google Generative AI SDK**: Gemini 2.0 Flash-Lite integration
- **SQLite**: `better-sqlite3` for database storage
- **Zod**: Schema validation
- **i18next / react-i18next**: Internationalization
- **@ducanh2912/next-pwa**: PWA features
- **@sentry/nextjs**: Error tracking
- **zustand**: State management
- **Playwright**: End-to-end testing
- **Jest / React Testing Library**: Unit/Integration testing
- **ESLint / Prettier**: Linting & Formatting
- **Husky / lint-staged**: Git hooks
- **Turbopack**: (Optional, used with `npm run dev`)

## How It Works

1.  **Sign in**: Use GitHub, Google, or Discord authentication.
2.  **Select Settings**: Choose CEFR level (A1-C2) and target language.
3.  **Generate Exercise**: Request an AI-generated reading passage and question.
4.  **Comprehension Test**: Answer the multiple-choice question.
5.  **Feedback & Review**: Receive instant feedback, explanations, and highlighting.
6.  **Repeat or New**: Practice more or generate a new exercise.

## API Cost Management

Comprehendo implements strategies to manage AI API costs:

- **Rate Limiting**:
  - Uses a fixed-window counter based on IP address, stored in the `rate_limits` SQLite table.
  - Default limit: **100 requests per hour** per IP to the exercise generation endpoint (`POST /api/exercise`).
  - Applies to all users (anonymous and logged-in).
  - Implemented in `app/actions/exercise.ts`.
  - Exceeding the limit logs a warning to Sentry (if configured).
  - Adjust `MAX_REQUESTS_PER_HOUR` in `app/actions/exercise.ts`.
- **Database Caching**:
  - Successful AI-generated exercises (passage, question, choices, explanation) are stored in the `quiz` SQLite table.
  - Before calling the AI, the system checks for a suitable cached exercise based on language, level, and user interaction history (via `question_feedback` table).
  - This significantly reduces redundant API calls.
- **User Feedback Loop**: User feedback on questions (via `question_feedback` table) can potentially inform cache selection or future generation (verify implementation detail).
- **Multi-model Support**: Easily switch between OpenAI and Google AI models via the `ACTIVE_MODEL` environment variable to leverage different cost structures.

## CEFR Levels Explained

- **A1 (Beginner)**: Basic phrases, simple questions.
- **A2 (Elementary)**: Familiar topics, simple sentences.
- **B1 (Intermediate)**: Routine matters, basic opinions.
- **B2 (Upper Intermediate)**: Technical discussions, clear viewpoints.
- **C1 (Advanced)**: Complex topics, spontaneous expression.
- **C2 (Proficiency)**: Virtually everything, nuanced expression.

## Setup and Running

### Prerequisites

1.  **Node.js:** Version 18 or higher (Check `.nvmrc` or project docs if specific version needed).
2.  **npm or yarn:** Package manager.
3.  **Git:** For cloning.
4.  **API Keys & Credentials:**
    - **OpenAI:** [platform.openai.com/account/api-keys](https://platform.openai.com/account/api-keys)
    - **Google AI:** [makersuite.google.com/app/apikey](https://makersuite.google.com/app/apikey)
    - **GitHub OAuth App:** [github.com/settings/developers](https://github.com/settings/developers)
    - **Google Cloud OAuth Credentials:** [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)
    - **Discord OAuth App:** [discord.com/developers/applications](https://discord.com/developers/applications)
    - _(Optional Deployment)_ [Fly.io Account](https://fly.io/) & [Fly CLI](https://fly.io/docs/hands-on/install-flyctl/).

### Running Locally

1.  **Clone:**
    ```bash
    git clone https://github.com/your-username/comprehendo.git # Replace if forked
    cd comprehendo
    ```
2.  **Install:**
    ```bash
    npm install
    # or yarn install
    ```
3.  **Configure Environment:**

    - Copy `.env.example` to `.env.local`: `cp .env.example .env.local`
    - Edit `.env.local` and fill in **all required** API keys and OAuth credentials:
      - `OPENAI_API_KEY` (optional, if using OpenAI)
      - `GOOGLE_AI_API_KEY` (optional, if using Google AI)
      - `GITHUB_ID`, `GITHUB_SECRET` (optional, if enabling GitHub login)
      - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (optional, if enabling Google login)
      - `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` (optional, if enabling Discord login)
      - `AUTH_SECRET`: Generate with `openssl rand -base64 32`
      - `NEXTAUTH_URL=http://localhost:3000` (for local dev)
      - `ADMIN_EMAILS`: Comma-separated list of emails for admin access (e.g., `admin@example.com,test@test.com`).
      - `ACTIVE_MODEL`: (Optional) Set to `gpt-3.5-turbo` or `gemini-2.0-flash-lite`. Defaults to Gemini if unset/invalid.
    - Ensure at least one AI provider and one Auth provider are configured.

4.  **Run Dev Server:**

    ```bash
    npm run dev
    ```

    _(Uses Turbopack by default)_

5.  **Open App:** [http://localhost:3000](http://localhost:3000)

### Deploying to Fly.io (Optional)

Continuous Deployment is set up via GitHub Actions (`.github/workflows/fly.yml`). Pushing to `main` triggers deployment.

**First-Time Fly.io Setup:**

1.  **Login:** `fly auth login`
2.  **Create App:** `fly apps create <your-app-name>` (Use a unique name)
3.  **Create Volume:** `fly volumes create sqlite_data --app <your-app-name> --region <your-region> --size 1` (e.g., `lhr` for London)
4.  **Set Production Secrets:**
    - **Crucial:** Edit `.env.local`, change `NEXTAUTH_URL` to `https://<your-app-name>.fly.dev`. Ensure all other keys/secrets are for production.
    - Import secrets: `fly secrets import --app <your-app-name> < .env.local`
    - Verify/set individual secrets if needed: `fly secrets set KEY=VALUE --app <your-app-name>`
    - **Ensure `ADMIN_EMAILS` is set for production admin access.**
5.  **Get Fly Token:** `fly auth token` (Copy the token)
6.  **Add GitHub Secret:**
    - Repo > Settings > Secrets and variables > Actions > "New repository secret".
    - Name: `FLY_API_TOKEN`
    - Value: Paste the token.

**Deployment:**

- Push to `main`: `git push origin main`
- Monitor in GitHub Actions tab.

**Manual Deployment:**

```bash
fly deploy --app <your-app-name>
```

### Switching AI Models

- **Locally:** Change `ACTIVE_MODEL` in `.env.local`.
- **Production (Fly.io):** Update the secret:
  ```bash
  fly secrets set ACTIVE_MODEL=<model_name> --app <your-app-name>
  # e.g., model_name = gpt-3.5-turbo or gemini-2.0-flash-lite
  fly apps restart <your-app-name>
  ```

## Development Workflow

Key scripts defined in `package.json`:

```bash
# Run dev server (with Turbopack)
npm run dev

# Build for production
npm run build

# Start production server locally
npm run start

# Check formatting & linting
npm run verify

# Fix formatting & linting, run type checks, unit tests, e2e tests
npm run check

# Run unit/integration tests (Jest)
npm run test

# Run Jest in watch mode
npm run test:watch

# Run end-to-end tests (Playwright)
npm run test:e2e

# Check for dependency updates
npm run deps

# Update dependencies interactively
npm run deps:update

# Remove node_modules, lockfile, build artifacts
npm run nuke
```

### Testing Strategy

- **Co-location**: Test files (`*.test.ts`, `*.test.tsx`) live alongside the source files they test.
- **Unit/Integration**: Jest and React Testing Library (`npm test`).
- **End-to-End**: Playwright (`npm run test:e2e`) checks full user flows. See E2E Authentication Setup below.
- **Git Hooks**: Husky and lint-staged automatically run checks:
  - **Pre-commit**: Formats staged files (`prettier`) and runs related Jest tests (`test:quick`).
  - **Pre-push**: Runs `npm run verify` (full format check, lint, build checks) - currently disabled/not standard, verify `husky` config. Typically pre-push runs more comprehensive checks like `npm run check` or `npm run build`. _Correction: Pre-commit hook runs prettier and related tests._

## Production Considerations

- **API Monitoring**: Monitor AI provider dashboards for usage and costs.
- **Rate Limits**: Adjust `MAX_REQUESTS_PER_HOUR` based on traffic and budget.
- **Security**: Review CORS, consider stricter input validation if needed.
- **Scaling**: Adjust Fly.io machine specs/count in `fly.toml`.
- **Database Backups**: Implement a backup strategy for the SQLite volume on Fly.io (e.g., using `litestream` or manual snapshots).
- **Sentry**: Configure DSN in environment variables for production error tracking.

## Customization

- **Languages**: Extend `LANGUAGES` in `app/config/languages.ts`.
- **Styling**: Modify Tailwind classes in components (`app/components`).
- **AI Prompts**: Adjust prompts in `app/actions/exercise.ts`.
- **Rate Limits**: Modify `MAX_REQUESTS_PER_HOUR` in `app/actions/exercise.ts`.
- **Cache Behavior**: Modify database queries in `app/actions/exercise.ts`.
- **Auth Providers**: Add/remove providers in `lib/authOptions.ts` and update environment variables.

## Code Structure

```
/
├── app/                      # Next.js App Router
│   ├── [lang]/               # Language-specific routes (i18n)
│   │   ├── page.tsx          # Main page component for a language
│   │   └── layout.tsx        # Layout for language routes
│   ├── actions/              # Server Actions (e.g., exercise generation)
│   ├── api/                  # API routes (auth, potentially others)
│   ├── components/           # Shared React components
│   ├── config/               # Application configuration (languages, topics)
│   ├── contexts/             # React Context providers (e.g., Language)
│   ├── store/                # Zustand state stores
│   ├── admin/                # Admin panel components/routes
│   ├── layout.tsx            # Root layout
│   ├── page.tsx              # Root page (redirects or landing)
│   ├── globals.css           # Global styles
│   ├── i18n.ts / i18n.client.ts # i18next config
│   └── ...
├── lib/                      # Shared libraries/utilities
│   ├── db.ts                 # Database connection & schema setup
│   ├── authOptions.ts        # NextAuth configuration
│   ├── modelConfig.ts        # AI model configuration
│   ├── domain/               # Domain schemas (Zod)
│   └── ...
├── public/                   # Static assets (images, locales, manifest.json)
│   ├── locales/              # i18next translation files
│   └── ...
├── data/                     # SQLite database file (local development)
├── docs/                     # Documentation files
│   └── text_generator_state_diagram.md # State diagram
├── scripts/                  # Utility scripts (e.g., db schema export)
├── test/                     # Test configurations and utilities
│   └── e2e/                  # Playwright E2E tests & auth state
├── .env.example              # Example environment variables
├── next.config.mjs           # Next.js configuration (check file extension)
├── tailwind.config.ts        # Tailwind CSS configuration
├── tsconfig.json             # TypeScript configuration
├── jest.config.js            # Jest configuration
├── playwright.config.ts      # Playwright configuration
├── Dockerfile / fly.toml     # Deployment configuration
├── package.json              # Project dependencies and scripts
└── README.md                 # This file
```

## Contributing

Contributions welcome!

1.  Fork the repository.
2.  Create branch: `git checkout -b feature/your-feature`.
3.  Commit changes: `git commit -m 'Add amazing feature'`.
4.  Push: `git push origin feature/your-feature`.
5.  Open Pull Request.

## Admin Panel

Accessible at `/admin` for users whose email is in `ADMIN_EMAILS`.

**Features:**

- View data from `users`, `quiz`, `question_feedback`, `rate_limits` tables.
- Basic pagination.
- Requires login; redirects non-admins.

**Setup:**

- Set `ADMIN_EMAILS` environment variable locally (`.env.local`) and in deployment (e.g., Fly.io secrets), comma-separated.

### E2E Test Authentication Setup

Certain Playwright end-to-end tests (especially those involving `/admin` access or user-specific behavior) require pre-generated authentication state to simulate logged-in users. This avoids needing to perform UI logins within the tests themselves. We need separate files for an admin user and a regular (non-admin) user.

These state files (`test/e2e/auth/*.storageState.json`) contain session information and are **not** committed to Git (as specified in `.gitignore`).

**Prerequisites:**

- At least one OAuth provider (GitHub, Google, Discord) is configured in your `.env.local`.
- The `ADMIN_EMAILS` variable is set in your `.env.local` with the email of your designated admin test user.
- You have access to both an admin test account and a non-admin test account for one of the configured OAuth providers.

**To generate the state files locally:**

1.  **Ensure Files Exist:** If they don't already exist, create empty files named exactly:
    - `test/e2e/auth/admin.storageState.json`
    - `test/e2e/auth/nonAdmin.storageState.json`
2.  **Run App:** Start the development server: `npm run dev`.
3.  **Login as Admin:** Using your browser, navigate to `http://localhost:3000` and log in as the **admin** user (whose email is listed in `ADMIN_EMAILS`).
4.  **Get Admin Cookie:** Open your browser's developer tools (usually F12). Go to the `Application` tab (Chrome/Edge) or `Storage` tab (Firefox), find `Cookies` for `http://localhost:3000`, and copy the **value** of the `next-auth.session-token` cookie.
5.  **Update `admin.storageState.json`:** Open the `test/e2e/auth/admin.storageState.json` file. Paste the copied admin token value, **replacing only the `YOUR_ADMIN_TOKEN_VALUE_HERE` placeholder**. Ensure the rest of the JSON structure remains exactly as shown:
    ```json
    {
      "cookies": [
        {
          "name": "next-auth.session-token",
          "value": "YOUR_ADMIN_TOKEN_VALUE_HERE",
          "domain": "localhost",
          "path": "/",
          "expires": -1,
          "httpOnly": true,
          "secure": false,
          "sameSite": "Lax"
        }
      ],
      "origins": []
    }
    ```
6.  **Log Out & Login as Non-Admin:** In your browser, log out of the application. Then, log back in as a regular **non-admin** user (an account whose email is **not** in `ADMIN_EMAILS`).
7.  **Get Non-Admin Cookie:** Repeat step 4 to get the new `next-auth.session-token` value for the non-admin user.
8.  **Update `nonAdmin.storageState.json`:** Open the `test/e2e/auth/nonAdmin.storageState.json` file. Paste the copied non-admin token value, **replacing only the `YOUR_NON_ADMIN_TOKEN_VALUE_HERE` placeholder**, using the same JSON structure as in step 5.

**Verification:**

Once both files are correctly populated, `npm run test:e2e` should now be able to successfully run tests that require admin or non-admin authentication.

**Troubleshooting:**

- If authentication tests still fail, double-check that you copied the correct cookie _value_ (not the name), pasted it into the correct file, and that the JSON structure in both `.storageState.json` files is valid and matches the example exactly (except for the token value itself).

## Database

Uses SQLite via `better-sqlite3`. The database file is `data/comprehendo.sqlite` locally, and stored on a persistent volume (`/data/comprehendo.sqlite`) in production (Fly.io).

### SQLite Command Line (Local)

```bash
# Navigate to project root
sqlite3 data/comprehendo.sqlite
```

Useful commands: `.tables`, `SELECT * FROM users LIMIT 5;`, `.schema quiz`, `.quit`.

### Database Schema

```sql
-- From lib/db.ts initialization logic

CREATE TABLE IF NOT EXISTS quiz (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  language TEXT NOT NULL,          -- Target language of the passage (e.g., 'fr')
  level TEXT NOT NULL,             -- CEFR level (e.g., 'B1')
  content TEXT NOT NULL,           -- JSON string containing passage, question, options, explanation
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  question_language TEXT,        -- Language the question/options are in (e.g., 'en')
  user_id INTEGER,               -- User who generated this (if logged in)
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id TEXT NOT NULL,       -- User ID from the OAuth provider
  provider TEXT NOT NULL,          -- OAuth provider name (e.g., 'github', 'google', 'discord')
  name TEXT,                     -- User's display name
  email TEXT,                    -- User's email address
  image TEXT,                    -- URL to user's profile picture
  first_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  language TEXT DEFAULT 'en',    -- Preferred UI language for the user
  UNIQUE(provider_id, provider)  -- Ensure unique user per provider
);

CREATE TABLE IF NOT EXISTS user_language_progress (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL,     -- Target language being practiced (e.g., 'fr')
  cefr_level TEXT NOT NULL DEFAULT 'A1', -- Current tracked level for this language
  correct_streak INTEGER NOT NULL DEFAULT 0,
  last_practiced TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, language_code)
);

CREATE TABLE IF NOT EXISTS question_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quiz_id INTEGER NOT NULL,        -- The quiz this feedback relates to
  user_id INTEGER NOT NULL,        -- The user providing feedback
  rating TEXT NOT NULL CHECK(rating IN ('good', 'bad')), -- User's quality rating
  user_answer TEXT,              -- The answer submitted by the user (e.g., 'A', 'B')
  is_correct INTEGER,            -- 1 if correct, 0 if incorrect
  submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (quiz_id) REFERENCES quiz (id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rate_limits (
  ip_address TEXT PRIMARY KEY,     -- User's IP address
  request_count INTEGER NOT NULL DEFAULT 1, -- Number of requests in the current window
  window_start_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP -- Start time of the rate limit window
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_quiz_created_at ON quiz(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login DESC);
CREATE INDEX IF NOT EXISTS idx_user_language_progress_last_practiced ON user_language_progress(last_practiced DESC);
CREATE INDEX IF NOT EXISTS idx_question_feedback_quiz_id ON question_feedback (quiz_id);
CREATE INDEX IF NOT EXISTS idx_question_feedback_user_id ON question_feedback (user_id);
```

## Troubleshooting

- **Database Connection:** Ensure `data/` dir exists locally. On Fly, check volume mount (`fly.toml`) and status (`fly status`).
- **Auth Errors:** Verify `.env.local` / Fly secrets (`AUTH_SECRET`, provider IDs/secrets, `NEXTAUTH_URL`). Ensure OAuth callback URLs match exactly in provider settings (e.g., `http://localhost:3000/api/auth/callback/github` or `https://<app>.fly.dev/api/auth/callback/github`).
- **API Key Errors:** Check AI provider keys in env/secrets. Ensure billing is enabled if required by the provider.
- **Rate Limit Errors:** Wait for the hour window to reset. Check `rate_limits` table via SQLite or Admin Panel if needed. Consider increasing `MAX_REQUESTS_PER_HOUR` if appropriate.
- **Admin Access Denied:** Confirm logged-in user's email is EXACTLY in `ADMIN_EMAILS` (case-sensitive, no extra spaces). Check Fly secrets value.
- **Deployment Issues:** Examine GitHub Actions logs and `fly logs --app <your-app-name>`.
- **PWA Issues:** Check `next.config.mjs` PWA settings and browser dev tools (Application -> Service Workers/Manifest).

## License

MIT License. See [LICENSE](LICENSE) file.
