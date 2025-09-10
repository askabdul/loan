# 🔧 API Connection Error Fix

## The Problem
You're seeing this error in your hosted version:
```
PUT http://localhost:5000/api/users/work-info net::ERR_CONNECTION_REFUSED
Error updating work info: TypeError: Failed to fetch
```

## Why This Happens
- Your frontend is hosted online but trying to connect to `localhost:5000`
- `localhost` only works on your local computer, not from a hosted website
- The hosted frontend needs a public backend URL

## Quick Fix

### Step 1: Deploy Your Backend
Your backend (`cedi-loan-backend`) needs to be hosted online. Popular free options:

- **Heroku**: `https://your-app.herokuapp.com`
- **Railway**: `https://your-app.railway.app`  
- **Render**: `https://your-app.onrender.com`

### Step 2: Update API URL
Once your backend is deployed, update the frontend configuration:

**Option A: Use the script (Recommended)**
```bash
# Replace with your actual backend URL
npm run update-api-url production https://your-backend-url.com/api
```

**Option B: Manual update**
Edit `.env.production`:
```env
REACT_APP_API_URL=https://your-backend-url.com/api
```

### Step 3: Rebuild and Deploy
```bash
npm run build:production
# Then upload the 'build' folder to your hosting platform
```

## Test Locally First

Before deploying, test with your production backend:

```bash
# Set production API URL
npm run update-api-url local https://your-backend-url.com/api

# Start local development
npm start

# Test the work info update
# If it works, your backend is properly deployed

# Reset to local development
npm run set-local-api
```

## Helpful Commands

```bash
# Check current API URL
npm run check-env

# Set local development API
npm run set-local-api

# Set production API (replace URL)
npm run update-api-url production https://your-backend.com/api

# Build for production
npm run build:production
```

## Backend Deployment Quick Start

### Using Railway (Recommended - Free)
1. Go to [railway.app](https://railway.app)
2. Connect your GitHub account
3. Deploy from your `cedi-loan-backend` repository
4. Railway will give you a URL like `https://your-app.railway.app`
5. Use this URL + `/api` as your `REACT_APP_API_URL`

### Using Heroku
```bash
cd cedi-loan-backend
heroku create your-app-name
git add .
git commit -m "Deploy to Heroku"
git push heroku main
```

## Still Having Issues?

1. **Backend not accessible?**
   - Check if you can visit `https://your-backend-url.com/api/health` in browser
   - Should return JSON with status "OK"

2. **CORS errors?**
   - Your backend needs to allow your frontend domain
   - Check backend CORS configuration

3. **Environment variables not working?**
   - Restart development server after changing .env
   - For production, rebuild with `npm run build:production`

## Summary

✅ **Working**: `localhost:5000` → `localhost:3000` (local development)  
❌ **Broken**: `localhost:5000` → `hosted-frontend.com` (production)  
✅ **Fixed**: `hosted-backend.com` → `hosted-frontend.com` (production)

The key is making sure both frontend and backend are accessible from the internet when deployed.