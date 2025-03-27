# Comprehend

An English Comprehension Game powered by Next.js and OpenAI

## Getting Started

### Development

```bash
# Install dependencies
npm install

# Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

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

## License

MIT
