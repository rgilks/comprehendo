# Comprehend

A multi-language reading comprehension practice tool powered by Next.js, OpenAI, and Google Gemini

![Comprehend Screenshot](public/screenshot.png)

## Overview

Comprehend is an AI-powered language learning application designed to help users improve their reading comprehension skills in multiple languages. The application generates customized reading passages based on the user's selected language and proficiency level (CEFR), then provides multiple-choice questions to test understanding.

## Features

- **Multi-language Support**: Practice reading comprehension in English, Italian, Spanish, French, or German
- **CEFR Level Selection**: Choose from six proficiency levels (A1-C2) to match your current language skills
- **AI-Generated Content**: Fresh, unique reading passages generated for each practice session
- **Multiple AI Model Support**: Switch between OpenAI's GPT-3.5 Turbo and Google's Gemini 2.0 Flash-Lite via environment variables
- **Interactive Quiz Format**: Answer multiple-choice questions and receive immediate feedback
- **Detailed Explanations**: Learn why answers are correct or incorrect with thorough explanations
- **Text Highlighting**: See the relevant portion of text highlighted after answering
- **User Authentication**: Secure login via GitHub and Google OAuth
- **Data Persistence**: Store user preferences and usage statistics in SQLite
- **Responsive Design**: Optimized for both desktop and mobile devices
- **Modern UI**: Clean, intuitive interface with smooth animations and visual feedback
- **Cost-Control System**: Intelligent rate limiting and caching to manage API costs
- **Robust Validation**: Uses Zod for request validation on API routes.
- **Smooth Loading Experience**: Enhanced loading indicators and transitions
- **Continuous Deployment**: Automatic deployment to Fly.io when code is pushed to main branch

## How It Works

1. **Sign in**: Use GitHub or Google authentication to access the application
2. **Select your settings**: Choose your CEFR level (A1-C2) and preferred reading language
3. **Generate a passage**: The application creates a reading passage tailored to your proficiency level
4. **Test your comprehension**: Answer the multiple-choice question and receive instant feedback with explanations
5. **Review explanations**: After answering, see why each option was correct or incorrect
6. **Try again or generate new**: Practice with the same content or generate a new passage

## API Cost Management

Comprehend implements several strategies to manage OpenAI API costs:

- **Rate Limiting**: Users are limited to 100 requests per hour to prevent excessive API usage
- **Response Caching**: Successful API responses are cached for 24 hours to reduce duplicate calls
- **Intelligent Seed System**: Random seeds create variety in cached responses to avoid repetitive content
- **Graceful Error Handling**: User-friendly messages when rate limits are reached

## CEFR Levels Explained

- **A1 (Beginner)**: Basic phrases, simple questions
- **A2 (Elementary)**: Familiar topics, simple sentences
- **B1 (Intermediate)**: Routine matters, basic opinions
- **B2 (Upper Intermediate)**: Technical discussions, clear viewpoints
- **C1 (Advanced)**: Complex topics, spontaneous expression
- **C2 (Proficiency)**: Virtually everything, nuanced expression

## Setup and Running

Follow these steps to get Comprehend running on your local machine and optionally deploy it to Fly.io.

### Prerequisites

Before you begin, make sure you have the following installed and set up:

1.  **Node.js:** Version 18 or higher. (Download from [nodejs.org](https://nodejs.org/)).
2.  **npm or yarn:** Package manager for Node.js (npm comes with Node.js).
3.  **Git:** For cloning the repository. (Download from [git-scm.com](https://git-scm.com/)).
4.  **API Keys & Credentials:** You'll need accounts and credentials from these services:
    - **OpenAI:** For the GPT model. Get an API key at [platform.openai.com/account/api-keys](https://platform.openai.com/account/api-keys).
    - **Google AI:** For the Gemini model. Get an API key at [makersuite.google.com/app/apikey](https://makersuite.google.com/app/apikey).
    - **GitHub:** For user login. Create an OAuth App at [github.com/settings/developers](https://github.com/settings/developers).
    - **Google Cloud:** For user login. Create OAuth credentials at [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials).
    - _(Optional) For Deployment:_ A [Fly.io](https://fly.io/) account and the [Fly CLI](https://fly.io/docs/hands-on/install-flyctl/) installed (`curl -L https://fly.io/install.sh | sh`).

### Running Locally

1.  **Clone the Repository:**

    ```bash
    git clone https://github.com/your-username/comprehend.git
    cd comprehend
    ```

    _(Replace `your-username` with the actual repository path if you forked it)._

2.  **Install Dependencies:**

    ```bash
    npm install
    ```

    _(Or `yarn install` if you prefer yarn)._

3.  **Configure Environment Variables:**

    - Copy the example environment file:
      ```bash
      cp .env.example .env.local
      ```
    - Edit the new `.env.local` file with a text editor.
    - Fill in the values for `OPENAI_API_KEY`, `GOOGLE_AI_API_KEY`, `GITHUB_ID`, `GITHUB_SECRET`, `GOOGLE_CLIENT_ID`, and `GOOGLE_CLIENT_SECRET` using the credentials you obtained in the Prerequisites step.
    - Generate a secret key for `AUTH_SECRET` by running `openssl rand -base64 32` in your terminal and pasting the output.
    - Keep `NEXTAUTH_URL=http://localhost:3000` for local development.
    - The `.env.example` file has comments explaining each variable.

4.  **Run the Development Server:**

    ```bash
    npm run dev
    ```

5.  **Open the App:**
    Navigate to [http://localhost:3000](http://localhost:3000) in your web browser.

### Deploying to Fly.io (Optional)

This project includes configuration for continuous deployment to Fly.io using GitHub Actions. When you push code to the `main` branch, it will automatically deploy.

**First-Time Setup:**

1.  **Login to Fly CLI:**

    ```bash
    fly auth login
    ```

2.  **Create a Fly App:**

    ```bash
    # Choose a unique name for your app (e.g., my-comprehend-app)
    fly apps create <your-app-name>
    ```

3.  **Create a Persistent Volume:** (For the SQLite database)

    ```bash
    # Use the same app name as above. Choose a region (e.g., lhr for London).
    fly volumes create sqlite_data --app <your-app-name> --region lhr --size 1
    ```

4.  **Set Production Secrets:**

    - **Important:** Edit your `.env.local` file. Change `NEXTAUTH_URL` to your Fly app's URL (e.g., `https://<your-app-name>.fly.dev`). Make sure all other API keys and secrets are the production values you intend to use.
    - Import the secrets into Fly.io:
      ```bash
      # Make sure you are in the project directory
      fly secrets import --app <your-app-name> < .env.local
      ```
    - _Note:_ You can also set secrets individually using `fly secrets set KEY=VALUE --app <your-app-name>`.

5.  **Get Fly API Token:**

    ```bash
    fly auth token
    ```

    - Copy the displayed token.

6.  **Add Token to GitHub Secrets:**
    - Go to your GitHub repository > Settings > Secrets and variables > Actions.
    - Click "New repository secret".
    - Name the secret `FLY_API_TOKEN`.
    - Paste the token you copied in the previous step into the "Value" field.
    - Click "Add secret".

**Deployment:**

- With the above steps completed, simply push your code to the `main` branch on GitHub.
  ```bash
  git push origin main
  ```
- The GitHub Action defined in `.github/workflows/fly.yml` will automatically run `fly deploy` using your `FLY_API_TOKEN` and the secrets configured in Fly.io.
- You can monitor the deployment progress in the "Actions" tab of your GitHub repository.

**Manual Deployment:**

If you need to deploy manually (without pushing to `main`), run:

```bash
fly deploy --app <your-app-name>
```

### Switching AI Models

To switch between OpenAI and Google AI models:

- **Locally:** Change the `ACTIVE_MODEL` variable in your `.env.local` file.
- **Production (Fly.io):** Update the secret in Fly.io:

  ```bash
  fly secrets set ACTIVE_MODEL=gpt-3.5-turbo --app <your-app-name>
  # or
  fly secrets set ACTIVE_MODEL=gemini-2.0-flash-lite --app <your-app-name>

  # Restart the app to apply the change
  fly apps restart <your-app-name>
  ```

## Development Workflow

Comprehend uses a modern development workflow with several tools to ensure code quality:

```bash
# Format code using Prettier
npm run format

# Check formatting without making changes
npm run format:check

# Run tests
npm run test

# Run ESLint
npm run lint

# Verify code (format + lint + build checks)
npm run verify
```

Git hooks (powered by Husky) automatically run on commit and push:

- **Pre-commit**: Formats staged files and runs tests related to changed files
- **Pre-push**: Runs full formatting, linting, and build verification

This approach allows for fast local development while ensuring that code pushed to the repository meets quality standards.

## Technology Stack

- **Framework**: Next.js 15 (React 19)
- **Language**: TypeScript
- **Styling**: Tailwind CSS with custom animations
- **Authentication**: NextAuth.js with GitHub and Google OAuth providers
- **Database**: SQLite (via better-sqlite3)
- **AI Integration**:
  - OpenAI API (GPT-3.5-turbo)
  - Google Generative AI (Gemini 2.0 Flash-Lite)
- **Validation**: Zod
- **Deployment**: Configured for Fly.io with GitHub Actions CI/CD

## Production Considerations

When deploying to production, consider the following:

- **API Usage Monitoring**: Set up a dashboard to monitor OpenAI API usage and costs
- **Persistent Cache**: Replace the in-memory cache with Redis or a database for a multi-server setup
- **Rate Limit Adjustments**: Fine-tune the rate limits based on your user base and budget
- **Security**: Implement additional security measures like CORS and potentially more complex request validation beyond Zod's schema checks
- **Scaling**: Adjust Fly.io configuration in `fly.toml` for additional resources as needed
- **Authentication**: Configure additional OAuth providers as needed
- **Database Backups**: Set up regular backups of the SQLite database

## User Experience Features

- **Animated Feedback**: Visual cues and animations provide immediate feedback on user actions
- **Progressive Loading**: Enhanced loading states with contextual information about what's being generated
- **Highlighted Answers**: Correct text portions are highlighted in the reading passage after answering
- **Adaptive Difficulty**: Content complexity automatically matches the selected CEFR level
- **Mobile-Optimized**: Responsive design works on phones, tablets, and desktops
- **User Profiles**: Track progress and preferences across sessions with user authentication

## Customization

You can customize various aspects of the application:

- **Add More Languages**: Extend the `LANGUAGES` object in `app/components/TextGenerator.tsx`
- **Visual Design**: Modify the Tailwind classes and gradients in component files
- **API Prompt**: Adjust the prompt in the `generateText` function to change the content style
- **Rate Limits**: Configure the `MAX_REQUESTS_PER_HOUR` value in `app/api/chat/route.ts`
- **Cache Duration**: Change the `CACHE_TTL` value in `app/api/chat/route.ts`
- **Authentication**: Add or remove OAuth providers in `app/api/auth/[...nextauth]/route.ts`

## Code Structure

- `/app`: Main application code (Next.js App Router)
  - `/api`: API routes for OpenAI integration and authentication
  - `/components`: React components
  - `/globals.css`: Global styles and animations
  - `layout.tsx`: Root layout with authentication provider
  - `page.tsx`: Home page component
- `/data`: SQLite database directory (development)
- `/lib`: Utility functions and database configuration
- `/public`: Static assets
- `/scripts`: Helper scripts for development and deployment

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Troubleshooting

- **API Key Issues**: Ensure your API keys are correctly set in the `.env.local` file or Fly.io secrets
- **Rate Limit Errors**: If you see "rate limit exceeded" errors, wait for the cool-down period (1 hour)
- **Loading Indefinitely**: If content generation seems stuck, refresh the page and try with a different CEFR level
- **Authentication Errors**: Check OAuth configuration and ensure redirect URIs are correctly set
- **Database Errors**: Verify the SQLite volume is properly mounted in production
- **Deployment Issues**: Check GitHub Actions logs for errors in the CI/CD pipeline

## License

MIT
