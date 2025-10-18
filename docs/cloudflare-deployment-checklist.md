# Cloudflare Workers Deployment Checklist

## Pre-deployment Setup

### 1. Cloudflare Account Setup

- [ ] Create Cloudflare account
- [ ] Install Wrangler CLI: `npm install -g wrangler`
- [ ] Login to Wrangler: `wrangler login`

### 2. D1 Database Setup

- [ ] Create production database: `wrangler d1 create comprehendo-db`
- [ ] Create preview database: `wrangler d1 create comprehendo-db-preview`
- [ ] Update `wrangler.toml` with actual database IDs
- [ ] Run database migration: `wrangler d1 execute comprehendo-db --file=./scripts/migrate-d1.js`

### 3. Environment Variables

- [ ] Set NEXTAUTH_SECRET: `wrangler secret put NEXTAUTH_SECRET`
- [ ] Set GOOGLE_CLIENT_ID: `wrangler secret put GOOGLE_CLIENT_ID`
- [ ] Set GOOGLE_CLIENT_SECRET: `wrangler secret put GOOGLE_CLIENT_SECRET`
- [ ] Set GOOGLE_TRANSLATE_API_KEY: `wrangler secret put GOOGLE_TRANSLATE_API_KEY`
- [ ] Set ADMIN_EMAILS: `wrangler secret put ADMIN_EMAILS`

### 4. GitHub Secrets

- [ ] Add CLOUDFLARE_API_TOKEN to GitHub secrets
- [ ] Add CLOUDFLARE_ACCOUNT_ID to GitHub secrets

## Deployment Steps

### 1. Local Testing

- [ ] Run `npm run build:cf` to test OpenNext build
- [ ] Verify all dependencies are installed correctly
- [ ] Test database adapter in development mode

### 2. Deploy to Cloudflare

- [ ] Push to main branch to trigger GitHub Actions
- [ ] Monitor deployment in GitHub Actions tab
- [ ] Verify deployment success in Cloudflare dashboard

### 3. Post-deployment Verification

- [ ] Test application functionality
- [ ] Verify database operations work
- [ ] Check authentication flows
- [ ] Test admin panel access
- [ ] Verify all API endpoints work

## Troubleshooting

### Common Issues

1. **Database connection errors**: Check D1 database IDs in wrangler.toml
2. **Authentication failures**: Verify OAuth provider settings
3. **Build failures**: Check OpenNext configuration
4. **Environment variable issues**: Verify all secrets are set correctly

### Useful Commands

```bash
# Check deployment status
wrangler deployments list

# View logs
wrangler tail

# Test locally with Wrangler
wrangler dev

# Check D1 database
wrangler d1 list
```
