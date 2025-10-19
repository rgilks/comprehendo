# Cloudflare Deployment Guide

This guide walks you through deploying the Comprehendo application to Cloudflare Workers using OpenNext and Cloudflare D1.

## Prerequisites

- Cloudflare account
- GitHub repository with the `cloudflare` branch
- All environment variables and API keys ready

## Step 1: Create Cloudflare API Token

1. Go to [Cloudflare API Tokens](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/)
2. Click **"Create Token"**
3. Use **"Custom token"** template
4. Configure the token with these permissions:
   - `Account:Cloudflare Workers:Edit`
   - `Account:Cloudflare D1:Edit`
   - `Zone:Zone:Read` (if using custom domain)
5. **Account Resources**: Include your account
6. **Zone Resources**: Include specific zones (if using custom domains)
7. Click **"Continue to summary"** and then **"Create Token"**
8. **Copy and save the token** - you won't be able to see it again

## Step 2: Get Cloudflare Account ID

1. Go to your [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. In the right sidebar, find **"Account ID"**
3. Copy this value

## Step 3: Create D1 Database

1. In Cloudflare Dashboard, go to **Workers & Pages** → **D1 SQL Database**
2. Click **"Create database"**
3. Create the database:
   - **Name**: `comprehendo-db`
   - **Note**: Copy the Database ID for later

## Step 4: Update wrangler.toml Configuration

Update the `wrangler.toml` file with your actual database ID:

```toml
name = "comprehendo"
main = ".open-next/worker.js"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "comprehendo-db"
database_id = "YOUR_DATABASE_ID_HERE"

[vars]
NODE_ENV = "production"
```

Replace `YOUR_DATABASE_ID_HERE` with your D1 database ID.

## Step 5: Add GitHub Repository Secrets

In your GitHub repository:

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Click **"New repository secret"** for each of the following:

### Required Secrets

| Secret Name                | Description                | How to Get                               |
| -------------------------- | -------------------------- | ---------------------------------------- |
| `CLOUDFLARE_API_TOKEN`     | Cloudflare API token       | From Step 1                              |
| `CLOUDFLARE_ACCOUNT_ID`    | Cloudflare Account ID      | From Step 2                              |
| `NEXTAUTH_SECRET`          | NextAuth.js secret         | Generate with: `openssl rand -base64 32` |
| `GOOGLE_CLIENT_ID`         | Google OAuth Client ID     | From Google Cloud Console                |
| `GOOGLE_CLIENT_SECRET`     | Google OAuth Client Secret | From Google Cloud Console                |
| `GOOGLE_TRANSLATE_API_KEY` | Google Translate API Key   | From Google Cloud Console                |
| `ADMIN_EMAILS`             | Admin email addresses      | Comma-separated list                     |

### Generate NextAuth Secret

Run this command to generate a secure secret:

```bash
openssl rand -base64 32
```

## Step 6: Initialize D1 Databases

After creating the databases, run the schema migrations:

### Install Wrangler CLI

```bash
npm install -g wrangler
```

### Login to Cloudflare

```bash
wrangler login
```

### Run Database Migrations

```bash
# For production database
wrangler d1 execute comprehendo-db --file=app/lib/db/d1-migrations.sql
```

**Note**: If the SQL file doesn't exist, you can run the migrations manually by executing the SQL from `app/lib/db/d1-migrations.ts` in the Cloudflare D1 dashboard.

## Step 7: Deploy the Application

### Automatic Deployment

1. Commit and push your changes to the `cloudflare` branch:

   ```bash
   git add .
   git commit -m "Update wrangler.toml with database IDs"
   git push origin cloudflare
   ```

2. The GitHub Actions workflow will automatically:
   - Run tests
   - Build the application with OpenNext
   - Deploy to production

### Manual Deployment (Optional)

You can also deploy manually:

```bash
# Build the application
npm run build:cf

# Deploy to production
wrangler deploy
```

## Step 8: Verify Deployment

1. **Check GitHub Actions**: Go to your repository's Actions tab to see the deployment status
2. **Production URL**: The workflow will show the production deployment URL
3. **Test Application**: Visit the deployed URL and test:
   - Page loads correctly
   - Language switching works
   - Generate button functions
   - Authentication works (if configured)

## Step 9: Optional - Custom Domain Setup

If you want to use a custom domain:

1. **Add Domain to Cloudflare**:
   - Go to Cloudflare Dashboard
   - Add your domain
   - Update DNS settings

2. **Update wrangler.toml**:

   ```toml
   routes = [
     { pattern = "yourdomain.com/*", zone_name = "yourdomain.com" }
   ]
   ```

3. **Update GitHub Actions**: Add domain deployment to the workflow

## Troubleshooting

### Common Issues

1. **"CLOUDFLARE_API_TOKEN not found"**
   - Ensure the secret is added to GitHub repository secrets
   - Check the secret name matches exactly

2. **"Database not found"**
   - Verify database IDs in `wrangler.toml` are correct
   - Ensure databases are created in the correct Cloudflare account

3. **"Build failed"**
   - Check GitHub Actions logs for specific error messages
   - Ensure all dependencies are properly installed

4. **"Deployment failed"**
   - Verify API token has correct permissions
   - Check that account ID is correct

### Getting Help

- Check the [Cloudflare Workers documentation](https://developers.cloudflare.com/workers/)
- Review [OpenNext documentation](https://open-next.js.org/)
- Check GitHub Actions logs for detailed error messages

## Deployment URLs

After successful deployment, you'll have:

- **Production Environment**: `https://comprehendo.your-subdomain.workers.dev`

## Next Steps

Once deployed:

1. **Monitor Performance**: Use Cloudflare Analytics to monitor your application
2. **Set up Monitoring**: Configure alerts for errors and performance issues
3. **Scale as Needed**: Cloudflare Workers automatically scale based on demand
4. **Update Regularly**: Keep dependencies and configurations up to date

---

**Congratulations!** 🎉 Your application is now running on Cloudflare Workers with D1 database support.
