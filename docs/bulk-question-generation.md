# Bulk Question Generation Guide

This guide explains how to pregenerate hundreds or thousands of high-quality questions for Comprehendo, either locally on your machine or using other approaches.

## Overview

Comprehendo uses Google AI (Gemini) to generate reading comprehension exercises. For bulk generation, you have several options:

1. **Local Script (Recommended for overnight runs)**
2. **Cloud Script (For continuous generation)**
3. **Incremental Generation (Via existing app with higher limits)**

## Option 1: Local Script on M1 Mac (Recommended)

This is the simplest approach for generating questions overnight locally.

### Setup

1. **Increase Daily API Limit** (if needed):

   ```bash
   # In your .env.local file, increase the limit:
   MAX_DAILY_AI_REQUESTS=5000
   ```

2. **Install Dependencies** (if not already installed):

   ```bash
   npm install
   ```

3. **Ensure Database Exists**:
   ```bash
   # Run the dev server once to initialize the database
   npm run dev
   # Then stop it (Ctrl+C)
   ```

### Running the Script

The script is located at `scripts/bulk-generate-questions.ts`. You can configure it via environment variables:

```bash
# Basic usage - generate 100 questions
npx tsx scripts/bulk-generate-questions.ts

# Advanced configuration
TOTAL_QUESTIONS=500 \
  LANGUAGES=es,fr,de,it \
  LEVELS=A1,A2,B1,B2 \
  QUESTION_LANGUAGE=en \
  DELAY_MS=2000 \
  BATCH_SIZE=5 \
  MAX_DAILY_AI_REQUESTS=5000 \
  npx tsx scripts/bulk-generate-questions.ts
```

### Configuration Options

- **TOTAL_QUESTIONS**: Total number of questions to generate (default: 100)
- **LANGUAGES**: Comma-separated list of passage languages (default: `es,fr,de,it`)
  - Available: `zh`, `en`, `fil`, `fr`, `de`, `el`, `he`, `hi`, `it`, `ja`, `ko`, `pl`, `pt`, `ru`, `es`, `th`
- **LEVELS**: Comma-separated list of CEFR levels (default: `A1,A2,B1,B2`)
  - Available: `A1`, `A2`, `B1`, `B2`, `C1`, `C2`
- **QUESTION_LANGUAGE**: Language for questions/options (default: `en`)
- **DELAY_MS**: Delay between API requests in milliseconds (default: 2000)
- **BATCH_SIZE**: Number of parallel requests per batch (default: 5)
- **MAX_DAILY_AI_REQUESTS**: Override daily limit for this run (default: uses env var)

### Cost Tracking

The script automatically tracks API costs in real-time:

- **Token Usage**: Captures input and output token counts from each API call
- **Real-time Cost Updates**: Shows running costs and estimated remaining costs during generation
- **Final Summary**: Detailed cost breakdown including:
  - Total API requests
  - Total tokens consumed (input and output)
  - Total cost
  - Cost per successful question
  - Cost breakdown by token type

**Pricing Assumptions:**
- Default pricing assumes Gemini 2.5 Flash model (as of mid-2025)
- Input: $0.30 per million tokens
- Output: $2.50 per million tokens (including "thinking" tokens)
- Pricing may vary - check Google AI pricing for current rates

Example output:
```
Cost Summary
------------------------------------------------------------
Total API Requests: 1000
Total Input Tokens: 1,500,000
Total Output Tokens: 300,000
Total Tokens: 1,800,000

Total Cost: $0.8250
Cost per successful question: $0.0008
Tokens per successful question: 1800

Cost Breakdown:
  Input tokens: $0.4500 (1,500,000 tokens)
  Output tokens: $0.3750 (300,000 tokens)
```

### Running Overnight

To run the script overnight and handle interruptions:

```bash
# Use nohup to keep it running after terminal closes
nohup npx tsx scripts/bulk-generate-questions.ts > bulk-gen.log 2>&1 &

# Or use tmux/screen for better control
tmux new -s bulk-gen
# Run the command, then detach with Ctrl+B, D
# Reattach later with: tmux attach -t bulk-gen
```

### Monitoring Progress

The script outputs:

- Progress for each language/level combination
- Running statistics (success/fail counts)
- Final summary with breakdown by language and level

### Advantages

- ✅ Simple setup
- ✅ Full control over generation parameters
- ✅ Uses local database (no network latency)
- ✅ Can pause/resume by tracking progress
- ✅ No additional cloud costs
- ✅ Works perfectly on M1 Mac

### Limitations

- ⚠️ Bound by Google AI API rate limits and quotas
- ⚠️ Daily limit applies (default 1000, can be increased)
- ⚠️ Requires your machine to stay on overnight

### Cost Estimation

Assuming Google AI Gemini 2.5 Flash pricing (mid-2025):

- Input tokens: $0.30 per million tokens
- Output tokens: $2.50 per million tokens
- Estimated per question: ~1,500 input tokens + ~300 output tokens = ~$0.0008 per question
- For 1,000 questions: ~$0.80 - $1.00 total
- For 500 questions: ~$0.40 - $0.50 total
- With 2s delay between requests: ~1,800 questions/hour maximum
- For 500 questions: ~1-2 hours at conservative rate

## Option 2: Cloud Script (Alternative)

For continuous generation without keeping your machine on:

### Using Cloudflare Workers / Fly.io

1. Create a scheduled worker that runs periodically
2. Connects to your production D1 database (Cloudflare) or remote database
3. Generates questions in smaller batches throughout the day
4. Respects daily limits automatically

### Using a Cloud VM (AWS, GCP, etc.)

1. Deploy a Node.js script to a cloud instance
2. Set up cron job to run during off-peak hours
3. Connect to your production database
4. Monitor via cloud logging

**Note**: You'll need to configure database access credentials for remote connections.

## Option 3: Incremental via App

Increase the daily limit and let users naturally generate questions:

1. Set `MAX_DAILY_AI_REQUESTS` to a higher value
2. Questions are generated as users interact with the app
3. They're automatically cached and reused
4. No additional setup needed

## Quality Considerations

### What Makes a "Good" Question?

The system tracks quality through user feedback (`question_feedback` table):

- Users can mark questions as "good" or "bad"
- Questions marked as "good" are prioritized via `getRandomGoodQuestion()`

### Improving Quality Post-Generation

1. **Manual Review**: Use the admin panel to review generated questions
2. **User Feedback**: Let users provide feedback, then filter for good questions
3. **Automated Filtering**: Add logic to automatically mark questions as "good" based on metrics:
   - Question length
   - Explanation quality
   - Answer consistency
   - User success rate

### Quality Validation

The system includes validation in `app/lib/ai/question-validator.ts`:

- Basic structural checks (length, presence of all fields)
- Answer consistency with passage
- Explanation quality
- Semantic validation

Currently, validation warnings don't block questions, but you could enhance the bulk script to:

- Only save questions that pass stricter validation
- Reject and retry questions that fail quality checks
- Log quality metrics for later analysis

## Performance Tips

1. **Optimize Batch Size**: Too large = API rate limits, too small = slow. Start with 5.
2. **Adjust Delay**: 2s is conservative; you might be able to go faster depending on API limits.
3. **Focus on Popular Languages**: Generate more for languages users actually use.
4. **Prioritize Levels**: A1-A2 might need more questions than C1-C2.

## Troubleshooting

### Script fails with "Daily limit exceeded"

- Increase `MAX_DAILY_AI_REQUESTS` in `.env.local`
- Wait until next day (limit resets at midnight UTC)
- Check current usage in `ai_api_usage` table

### Questions aren't saving to database

- Ensure database file exists at `data/comprehendo.sqlite`
- Check file permissions
- Verify database schema is initialized

### API errors

- Verify `GOOGLE_AI_API_KEY` is set correctly
- Check Google AI API quota/limits in Google Cloud Console
- Reduce `BATCH_SIZE` or increase `DELAY_MS`

### Script runs but generates few questions

- Check error logs for failed generations
- Verify language/level combinations are valid
- Check that topics are available for selected levels

## Next Steps

1. **Run a small test first**: Start with `TOTAL_QUESTIONS=10` to verify everything works
2. **Scale up gradually**: Once confirmed, increase to 100, then 500, then 1000+
3. **Monitor quality**: Review generated questions in admin panel
4. **Collect user feedback**: Let users mark questions as good/bad
5. **Refine generation**: Adjust prompts or validation based on results

## Example: Generate 500 Questions Overnight

```bash
# Set configuration
export TOTAL_QUESTIONS=500
export LANGUAGES=es,fr,de,it,pt
export LEVELS=A1,A2,B1,B2
export DELAY_MS=2000
export BATCH_SIZE=5

# Run in background with logging
nohup npx tsx scripts/bulk-generate-questions.ts > bulk-gen-$(date +%Y%m%d).log 2>&1 &

# Check progress
tail -f bulk-gen-*.log

# Check database stats
sqlite3 data/comprehendo.sqlite "SELECT language, level, COUNT(*) FROM quiz GROUP BY language, level;"
```

This should generate ~500 questions in 2-4 hours, depending on API response times.
