# Comprehendo

A multi-language reading comprehension practice tool powered by Next.js and Google Gemini.

[![CI/CD](https://github.com/rgilks/comprehendo/actions/workflows/cloudflare-workers.yml/badge.svg)](https://github.com/rgilks/comprehendo/actions/workflows/cloudflare-workers.yml)

![Comprehendo Screenshot](public/screenshot.png)

<div align="center">
  <a href='https://ko-fi.com/N4N31DPNUS' target='_blank'><img height='36' style='border:0px;height:36px;' src='https://storage.ko-fi.com/cdn/kofi2.png?v=6' border='0' alt='Buy Me a Coffee at ko-fi.com' /></a>
</div>

## Overview

Comprehendo is an AI-powered language learning application designed to help users improve their reading comprehension skills in multiple languages. The application generates customized reading passages based on the user's selected language and proficiency level (CEFR), then provides multiple-choice questions to test understanding. Word translations are powered by the MyMemory Translation API (if integrated, otherwise specify).

## Features

- **Multi-language Support**:
  - Practice reading comprehension in various languages including English, Spanish, French, German, Italian, Portuguese, Russian, Hindi, Hebrew, Filipino, Latin, Greek, and Polish (defined in `app/config/languages.ts`).
  - The user interface is available in numerous languages (detected via available JSON files in `public/locales/`).
- **CEFR Level Selection**: Choose from six proficiency levels (A1-C2) to match your current language skills.
- **AI-Generated Content**: Fresh, unique reading passages generated for each practice session.
- **Interactive Quiz Format**: Answer multiple-choice questions and receive immediate feedback.
- **Detailed Explanations**: Learn why answers are correct or incorrect with thorough explanations.
- **Text Highlighting**: See the relevant portion of text highlighted after answering.
- **Word Translation**: Hover over any word to see its translation (powered by Google Translate API - requires `GOOGLE_TRANSLATE_API_KEY`).
- **Text-to-Speech**: Listen to passages and individual words using your browser/OS built-in capabilities (Web Speech API).
- **User Authentication**: Secure login via GitHub, Google, and Discord OAuth (providers enabled based on configured credentials).
- **Data Persistence**: Store user preferences and usage statistics in a Cloudflare D1 database (managed SQLite with global replication).
- **Responsive Design**: Optimized for both desktop and mobile devices.
- **Modern UI**: Clean, intuitive interface with smooth animations and visual feedback using Tailwind CSS.
- **Cost-Control System**: IP-based rate limiting and database caching to manage API costs.
- **Robust Validation**: Uses Zod for request validation on API routes and environment variables.
- **Smooth Loading Experience**: Enhanced loading indicators and transitions.
- **Cloudflare-Native Deployment**: Automatic deployment to Cloudflare Workers with D1 migrations applied via GitHub Actions when code is pushed to the `main` branch.
- **Admin Panel**: A secure area for administrators to view application data (users, quizzes, feedback).
- **Internationalization (i18n)**: Full i18n support for UI elements using `i18next` and locale files in `public/locales/`.
- **Cloudflare D1**: Managed SQLite storage used for caching, rate limiting, and progress tracking
  - Uses a fixed-window counter based on IP address, stored in the `rate_limits` Cloudflare D1 table.
  - Successful AI-generated exercises (passage, question, choices, explanation) are stored in the `quiz` Cloudflare D1 table.
    - **Cloudflare Account** with access to Workers and D1 (Workers Paid plan or higher for production usage).
    - **Wrangler CLI:** install globally (`npm install -g wrangler`) or run via `npx` for managing D1 and local dev.
    npx wrangler d1 migrations apply comprehendo --local
    The dev command runs the OpenNext Cloudflare adapter, wiring up Workers bindings (including the `COMPREHENDO_DB` D1 database) locally.
### Deploying to Cloudflare Workers
Automated deployments run via `.github/workflows/cloudflare-workers.yml`. Every push to `main` runs the quality checks, builds the OpenNext Cloudflare worker bundle, applies pending D1 migrations, and publishes to Cloudflare Workers.

High-level production setup (see [`docs/cloudflare-deployment.md`](docs/cloudflare-deployment.md) for detailed guidance):

1.  **Create a D1 database**:
    ```bash
    npx wrangler d1 create comprehendo
    ```
    Note the generated `database_id` and update `wrangler.toml`'s placeholder.
2.  **Run migrations:**
    ```bash
    npx wrangler d1 migrations apply comprehendo --remote
    ```
3.  **Configure the Worker deployment:**
    - Update `wrangler.toml` with the real D1 `database_id` and (optionally) production-specific variables.
    - In the Cloudflare dashboard, create a Workers project that uses the script name defined in `wrangler.toml` (defaults to `comprehendo`).
    - Add a D1 binding named `COMPREHENDO_DB` pointing to the database created above.
    - Set required environment variables/secrets on the Worker (auth provider keys, `AUTH_SECRET`, `ADMIN_EMAILS`, AI keys, etc.).
4.  **Set GitHub secrets/variables for CI:**
    - Secrets: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`
    - Repository variable: `CLOUDFLARE_D1_NAME` (e.g., `comprehendo`).
Once configured, merge to `main` to deploy, or trigger the workflow manually from the Actions tab.

# Run dev server with Cloudflare bindings (D1, Workers APIs)
# Start production server locally (Node fallback)
- **Scaling**: Cloudflare Workers automatically scale globally. Consider enabling Smart Placement for latency-sensitive workloads and tune caching/edge TTLs via Cloudflare rules if needed.
- **Database Backups**: Use `wrangler d1 backup` (or regular exports) to snapshot the Cloudflare D1 database and store backups securely.
├── migrations/               # Cloudflare D1 SQL migrations
├── wrangler.toml             # Cloudflare Workers & D1 configuration
├── Dockerfile                # (Optional) container build for local experimentation

- Set `ADMIN_EMAILS` environment variable locally (`.env.local`) and in deployment (Cloudflare Worker environment variables), comma-separated.

Comprehendo implements strategies to manage AI API costs:

- **Rate Limiting**:
  - Uses a fixed-window counter based on IP address, stored in the `rate_limits` SQLite table.
  - Default limit: **100 requests per hour** per IP to the exercise generation endpoint (`POST /api/exercise`).
  - Applies to all users (anonymous and logged-in).
  - Implemented in `app/actions/exercise.ts` via the `checkRateLimit` function (which uses logic from `lib/rate-limiter.ts`).
  - Exceeding the limit logs blocks the request.
  - Adjust `MAX_REQUESTS_PER_HOUR` in `lib/rate-limiter.ts`.
- **Database Caching**:
  - Successful AI-generated exercises (passage, question, choices, explanation) are stored in the `quiz` SQLite table.
  - Before calling the AI, the system checks for a suitable cached exercise based on language, level, and user interaction history (via `question_feedback` table) using the `getCachedExercise` function in `app/actions/exercise.ts`.
  - This significantly reduces redundant API calls.
- **User Feedback Loop**: User feedback on questions (stored in the `question_feedback` table) is used to avoid showing previously seen questions to logged-in users when fetching from the cache.

## CEFR Levels Explained

- **A1 (Beginner)**: Basic phrases, simple questions.
- **A2 (Elementary)**: Familiar topics, simple sentences.
- **B1 (Intermediate)**: Routine matters, basic opinions.
- **B2 (Upper Intermediate)**: Technical discussions, clear viewpoints.
- **C1 (Advanced)**: Complex topics, spontaneous expression.
- **C2 (Proficiency)**: Virtually everything, nuanced expression.

## Setup and Running

### Prerequisites

1.  **Node.js:** Version 18 or higher (Recommend setting this in `package.json` `engines` field).
2.  **npm:** Package manager (Scripts configured for npm).
3.  **Git:** For cloning.
4.  **API Keys & Credentials:**
    - **Google AI:** [makersuite.google.com/app/apikey](https://makersuite.google.com/app/apikey)
    - **GitHub OAuth App:** [github.com/settings/developers](https://github.com/settings/developers)
    - **Google Cloud OAuth Credentials:** [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)
    - **Discord OAuth App:** [discord.com/developers/applications](https://discord.com/developers/applications)
    - **Google Translate API Key:** (Optional, for hover translations) [console.cloud.google.com/apis/library/translate.googleapis.com](https://console.cloud.google.com/apis/library/translate.googleapis.com)
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
      - `GOOGLE_AI_API_KEY` (optional, if using Google AI)
      - `GOOGLE_AI_GENERATION_MODEL`: (Optional) The specific Google AI model to use for exercise generation (e.g., `gemini-2.5-flash-preview-04-17`). Defaults to a recommended flash model if not set.
      - `GITHUB_ID`, `GITHUB_SECRET` (optional, if enabling GitHub login)
      - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (optional, if enabling Google login)
      - `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` (optional, if enabling Discord login)
      - `AUTH_SECRET`: Generate with `openssl rand -base64 32`
      - `NEXTAUTH_URL`: The canonical URL of your deployment (e.g., `http://localhost:3000` for local development).
      - `ADMIN_EMAILS`: Comma-separated list of emails for admin access (e.g., `admin@example.com,test@test.com`).
      - `GOOGLE_TRANSLATE_API_KEY`: (Optional) Needed for hover translation feature.
      - `RATE_LIMIT_MAX_REQUESTS_PER_HOUR`: (Optional, default 100) Max exercise generation requests per IP per hour.
      - `RATE_LIMIT_WINDOW_MS`: (Optional, default 3600000) The window for rate limiting in milliseconds (1 hour).
    - Ensure at least one AI provider and one Auth provider (if desired) are configured.

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
    - **Ensure `RATE_LIMIT_MAX_REQUESTS_PER_HOUR` and `RATE_LIMIT_WINDOW_MS` are set appropriately for production.**
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

# Run end-to-end tests (Playwright)
npm run test:e2e

# Check for dependency updates
npm run deps

# Remove node_modules, lockfile, build artifacts
npm run nuke
```

### Testing Strategy

- **Co-location**: Test files (`*.test.ts`, `*.test.tsx`) live alongside the source files they test.
- **End-to-End**: Playwright (`npm run test:e2e`) checks full user flows. See E2E Authentication Setup below.

## Production Considerations

- **API Monitoring**: Monitor AI provider dashboards for usage and costs.
- **Rate Limits**: Adjust `MAX_REQUESTS_PER_HOUR` based on traffic and budget.
- **Security**: Review CORS, consider stricter input validation if needed.
- **Scaling**: Adjust Fly.io machine specs/count in `fly.toml`.
- **Database Backups**: Implement a backup strategy for the SQLite volume on Fly.io (e.g., using `litestream` or manual snapshots).

## Customization

- **Languages**: Extend `LANGUAGES` in `app/config/languages.ts`.
- **Styling**: Modify Tailwind classes in components (`app/components`).
- **AI Prompts**: Adjust prompts in `app/actions/exercise.ts`.
- **Rate Limits**: Modify `MAX_REQUESTS_PER_HOUR` in `lib/rate-limiter.ts`.
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
├── next.config.js            # Next.js configuration
├── tailwind.config.ts        # Tailwind CSS configuration
├── tsconfig.json             # TypeScript configuration
├── playwright.config.ts      # Playwright configuration
├── Dockerfile / fly.toml     # Deployment configuration
├── package.json              # Project dependencies and scripts
└── README.md                 # This file
```

## Contributing

Contributions welcome! Please ensure `npm run check` passes before submitting a PR.

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

Comprehendo uses **Cloudflare D1**, a globally distributed SQLite database available through Cloudflare Workers bindings. SQL migrations live in [`migrations/`](migrations/) and are applied via Wrangler (locally) or the deployment workflow.

### Managing the database locally

```bash
# Apply migrations to the local in-memory D1 instance
npx wrangler d1 migrations apply comprehendo --local

# Open an interactive shell (Ctrl+D to exit)
npx wrangler d1 shell comprehendo --local

# Run a one-off query
npx wrangler d1 execute comprehendo --local --command "SELECT COUNT(*) FROM quiz;"
```

### Database Schema

```sql
-- From migrations/0001_initial.sql

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
  is_good INTEGER NOT NULL CHECK(is_good IN (0, 1)), -- User's rating
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

- **Database Connection:** Ensure D1 migrations have been applied (`npx wrangler d1 migrations apply comprehendo --local` for local dev, `--remote` for production). Inspect data with `npx wrangler d1 execute` or the Admin panel.
- **Auth Errors:** Verify `.env.local` and Cloudflare Worker environment variables (`AUTH_SECRET`, provider IDs/secrets, `NEXTAUTH_URL`). Ensure OAuth callback URLs match exactly in provider settings (e.g., `http://localhost:3000/api/auth/callback/github` or your Cloudflare Worker domain).
- **API Key Errors:** Check AI provider keys in env/secrets. Ensure billing is enabled if required by the provider (e.g., Google Cloud Platform for Translate API).
- **Rate Limit Errors:** Wait for the hour window to reset. Check the `rate_limits` D1 table (CLI or Admin Panel). Consider increasing `MAX_REQUESTS_PER_HOUR` in `lib/rate-limiter.ts` if appropriate.
- **Admin Access Denied:** Confirm logged-in user's email is EXACTLY in `ADMIN_EMAILS` (case-sensitive, no extra spaces). Check the Cloudflare Worker environment variable value and ensure you've logged in with the correct account.
- **Deployment Issues:** Examine GitHub Actions logs (`Actions` tab) and Cloudflare Worker deploy logs. Confirm the Worker configuration (bindings, vars) and that GitHub secrets/variables are set correctly.
- **PWA Issues:** Check `next.config.js` PWA settings and browser dev tools (Application -> Service Workers/Manifest).

## License

MIT License. See [LICENSE](LICENSE) file.
