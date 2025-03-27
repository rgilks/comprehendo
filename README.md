# Comprehend

A multi-language reading comprehension practice tool powered by Next.js and OpenAI

![Comprehend Screenshot](public/screenshot.png)

## Overview

Comprehend is an AI-powered language learning application designed to help users improve their reading comprehension skills in multiple languages. The application generates customized reading passages based on the user's selected language and proficiency level (CEFR), then provides multiple-choice questions to test understanding.

## Features

- **Multi-language Support**: Practice reading comprehension in English, Italian, Spanish, French, or German
- **CEFR Level Selection**: Choose from six proficiency levels (A1-C2) to match your current language skills
- **AI-Generated Content**: Fresh, unique reading passages generated for each practice session
- **Interactive Quiz Format**: Answer multiple-choice questions and receive immediate feedback
- **Detailed Explanations**: Learn why answers are correct or incorrect with thorough explanations
- **Text Highlighting**: See the relevant portion of text highlighted after answering
- **Responsive Design**: Optimized for both desktop and mobile devices
- **Modern UI**: Clean, intuitive interface with smooth animations and visual feedback
- **Cost-Control System**: Intelligent rate limiting and caching to manage API costs
- **Smooth Loading Experience**: Enhanced loading indicators and transitions

## How It Works

1. **Select your settings**: Choose your CEFR level (A1-C2) and preferred reading language
2. **Generate a passage**: The application creates a reading passage tailored to your proficiency level
3. **Test your comprehension**: Answer the multiple-choice question and receive instant feedback with explanations
4. **Review explanations**: After answering, see why each option was correct or incorrect
5. **Try again or generate new**: Practice with the same content or generate a new passage

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

- Node.js (version 14 or higher)
- npm or yarn
- OpenAI API key

### Development

```bash
# Clone the repository
git clone https://github.com/your-username/comprehend.git
cd comprehend

# Install dependencies
npm install

# Set up environment variables
# Create a .env.local file with your OpenAI API key:
# OPENAI_API_KEY=your-key-here

# Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## Technology Stack

- **Framework**: Next.js 14 (React)
- **Language**: TypeScript
- **Styling**: Tailwind CSS with custom animations
- **AI Integration**: OpenAI API (GPT-3.5-turbo)
- **Deployment**: Configured for Fly.io

## API Configuration

The application requires an OpenAI API key to function. You can obtain an API key by signing up at [OpenAI's website](https://openai.com).

Add your API key to a `.env.local` file in the root directory:

```
OPENAI_API_KEY=your-openai-api-key
```

For production deployment, set the environment variable securely in your hosting provider.

## Deployment

This project is configured for continuous deployment to Fly.io from GitHub. Here's how it works:

1. When you push to the `main` branch, a GitHub Action automatically deploys to Fly.io
2. The deployment process uses the Dockerfile to build and deploy the application

### Setting Up Continuous Deployment

1. Sign up for a Fly.io account if you haven't already
2. Install the Fly CLI: `curl -L https://fly.io/install.sh | sh`
3. Login to Fly.io: `fly auth login`
4. Create a new Fly app (if you haven't already): `fly apps create comprehend`
5. Generate a Fly.io API token: `fly auth token`
6. Add the token as a GitHub repository secret named `FLY_API_TOKEN`
7. Add your OpenAI API key to Fly.io: `fly secrets set OPENAI_API_KEY="your-api-key-here"`

After setting up these steps, every push to the `main` branch will automatically deploy to Fly.io.

## Production Considerations

When deploying to production, consider the following:

- **API Usage Monitoring**: Set up a dashboard to monitor OpenAI API usage and costs
- **Persistent Cache**: Replace the in-memory cache with Redis or a database for a multi-server setup
- **Rate Limit Adjustments**: Fine-tune the rate limits based on your user base and budget
- **Security**: Implement additional security measures like CORS and request validation

## User Experience Features

- **Animated Feedback**: Visual cues and animations provide immediate feedback on user actions
- **Progressive Loading**: Enhanced loading states with contextual information about what's being generated
- **Highlighted Answers**: Correct text portions are highlighted in the reading passage after answering
- **Adaptive Difficulty**: Content complexity automatically matches the selected CEFR level
- **Mobile-Optimized**: Responsive design works on phones, tablets, and desktops

## Customization

You can customize various aspects of the application:

- **Add More Languages**: Extend the `LANGUAGES` object in `app/components/TextGenerator.tsx`
- **Visual Design**: Modify the Tailwind classes and gradients in component files
- **API Prompt**: Adjust the prompt in the `generateText` function to change the content style
- **Rate Limits**: Configure the `MAX_REQUESTS_PER_HOUR` value in `app/api/chat/route.ts`
- **Cache Duration**: Change the `CACHE_TTL` value in `app/api/chat/route.ts`

## Code Structure

- `/app`: Main application code (Next.js App Router)
  - `/api`: API routes for OpenAI integration
  - `/components`: React components
  - `/globals.css`: Global styles and animations
- `/public`: Static assets

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Troubleshooting

- **API Key Issues**: Ensure your OpenAI API key is correctly set in the `.env.local` file
- **Rate Limit Errors**: If you see "rate limit exceeded" errors, wait for the cool-down period (1 hour)
- **Loading Indefinitely**: If content generation seems stuck, refresh the page and try with a different CEFR level

## License

MIT
