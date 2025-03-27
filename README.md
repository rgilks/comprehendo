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

## How It Works

1. **Select your settings**: Choose your CEFR level (A1-C2) and preferred reading language
2. **Generate a passage**: The application creates a reading passage tailored to your proficiency level
3. **Test your comprehension**: Answer the multiple-choice question and receive instant feedback with explanations

## CEFR Levels Explained

- **A1 (Beginner)**: Basic phrases, simple questions
- **A2 (Elementary)**: Familiar topics, simple sentences
- **B1 (Intermediate)**: Routine matters, basic opinions
- **B2 (Upper Intermediate)**: Technical discussions, clear viewpoints
- **C1 (Advanced)**: Complex topics, spontaneous expression
- **C2 (Proficiency)**: Virtually everything, nuanced expression

## Getting Started

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

- **Framework**: Next.js (React)
- **Styling**: Tailwind CSS
- **AI Integration**: OpenAI API (GPT models)
- **Deployment**: Configured for Fly.io

## API Configuration

The application requires an OpenAI API key to function. You can obtain an API key by signing up at [OpenAI's website](https://openai.com).

Add your API key to a `.env.local` file in the root directory:

```
OPENAI_API_KEY=your-openai-api-key
```

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

## Customization

You can customize various aspects of the application:

- Add more languages by extending the `LANGUAGES` object in `app/components/TextGenerator.tsx`
- Modify the visual design by editing the Tailwind classes
- Adjust the AI prompt in the `generateText` function to change the type of content generated

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT
