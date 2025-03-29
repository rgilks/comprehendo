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

- **Rate Limiting**: Users are limited to 20 requests per hour to prevent excessive API usage
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

## Getting Started

### Prerequisites

- Node.js (version 18 or higher)
- npm or yarn
- OpenAI API key
- Google Generative AI API key (for Gemini)
- GitHub OAuth credentials (for authentication)
- Google OAuth credentials (for authentication)

### Development

```bash
# Clone the repository
git clone https://github.com/your-username/comprehend.git
cd comprehend

# Install dependencies
npm install

# Set up environment variables
# Create a .env.local file with your API keys and OAuth credentials:
# OPENAI_API_KEY=your-key-here
# GOOGLE_AI_API_KEY=your-gemini-key-here
# GITHUB_ID=your-github-oauth-client-id
# GITHUB_SECRET=your-github-oauth-client-secret
# GOOGLE_CLIENT_ID=your-google-oauth-client-id
# GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
# NEXTAUTH_URL=http://localhost:3000
# NEXTAUTH_SECRET=your-random-secret-here

# Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## Technology Stack

- **Framework**: Next.js 15 (React 19)
- **Language**: TypeScript
- **Styling**: Tailwind CSS with custom animations
- **Authentication**: NextAuth.js with GitHub and Google OAuth providers
- **Database**: SQLite (via better-sqlite3)
- **AI Integration**:
  - OpenAI API (GPT-3.5-turbo)
  - Google Generative AI (Gemini 2.0 Flash-Lite)
- **Deployment**: Configured for Fly.io with GitHub Actions CI/CD

## API Configuration

The application requires API keys to function:

1. **OpenAI API Key**: You can obtain an API key by signing up at [OpenAI's website](https://openai.com).
2. **Google AI API Key**: Sign up for Gemini access at [Google AI Studio](https://makersuite.google.com/app/apikey).
3. **GitHub OAuth**: Register a new OAuth application at [GitHub Developer Settings](https://github.com/settings/developers).
4. **Google OAuth**: Create credentials at [Google Cloud Console](https://console.cloud.google.com/apis/credentials).

Add your API keys to a `.env.local` file in the root directory:

```
OPENAI_API_KEY=your-openai-api-key
GOOGLE_AI_API_KEY=your-google-ai-key
GITHUB_ID=your-github-oauth-client-id
GITHUB_SECRET=your-github-oauth-client-secret
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-random-secret-here
# Optional: ACTIVE_MODEL=gemini-2.0-flash-lite (this is the default)
```

To switch between models, set the `ACTIVE_MODEL` environment variable:

- `gpt-3.5-turbo` - OpenAI's GPT-3.5 Turbo
- `gemini-2.0-flash-lite` - Google's Gemini 2.0 Flash-Lite (default if not specified)

For production deployment, set the environment variables securely in your hosting provider.

## Database

Comprehend uses SQLite for data persistence:

- **Development**: SQLite database is stored in the `data` directory
- **Production**: Database is stored in a Fly.io volume at `/data`

The database stores:

- User authentication data
- Generated content for caching
- Usage statistics for analytics and rate limiting

## Deployment

This project is configured for continuous deployment to Fly.io from GitHub. Here's how it works:

1. When you push to the `main` branch, a GitHub Action automatically deploys to Fly.io
2. The deployment process uses the Dockerfile to build and deploy the application

### Setting Up Continuous Deployment

1. Sign up for a Fly.io account if you haven't already
2. Install the Fly CLI: `curl -L https://fly.io/install.sh | sh`
3. Login to Fly.io: `fly auth login`
4. Create a new Fly app (if you haven't already): `fly apps create comprehend`
5. Create a volume for SQLite data: `fly volumes create sqlite_data -a comprehend -r lhr -s 1`
6. Generate a Fly.io API token: `fly auth token`
7. Add the token as a GitHub repository secret named `FLY_API_TOKEN`
8. Add your API keys to Fly.io:
   ```
   fly secrets set OPENAI_API_KEY="your-openai-api-key"
   fly secrets set GOOGLE_AI_API_KEY="your-google-ai-key"
   fly secrets set GITHUB_ID="your-github-oauth-client-id"
   fly secrets set GITHUB_SECRET="your-github-oauth-client-secret"
   fly secrets set GOOGLE_CLIENT_ID="your-google-oauth-client-id"
   fly secrets set GOOGLE_CLIENT_SECRET="your-google-oauth-client-secret"
   fly secrets set NEXTAUTH_URL="https://comprehend.fly.dev"
   fly secrets set NEXTAUTH_SECRET="your-random-secret-here"
   fly secrets set ACTIVE_MODEL="gemini-2.0-flash-lite"
   ```

The GitHub Action workflow will automatically deploy your application when you push to the main branch.

To manually deploy:

```
fly deploy
```

To switch between models in production, update the ACTIVE_MODEL secret:

```
fly secrets set ACTIVE_MODEL="gemini-2.0-flash-lite"
```

After updating the secret, restart your Fly.io app to apply the changes:

```
fly app restart
```

## Production Considerations

When deploying to production, consider the following:

- **API Usage Monitoring**: Set up a dashboard to monitor OpenAI API usage and costs
- **Persistent Cache**: Replace the in-memory cache with Redis or a database for a multi-server setup
- **Rate Limit Adjustments**: Fine-tune the rate limits based on your user base and budget
- **Security**: Implement additional security measures like CORS and request validation
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
