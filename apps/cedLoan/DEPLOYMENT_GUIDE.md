# CEDI Loan App - Deployment Guide

## Issue: Connection Refused Error in Hosted Version

### Problem Description
When the frontend is hosted/deployed, it's trying to connect to `http://localhost:5000/api` which doesn't exist in the hosted environment. The error `net::ERR_CONNECTION_REFUSED` occurs because:

1. `localhost:5000` only works in local development
2. The hosted frontend needs to connect to a publicly accessible backend URL

### Solution Steps

#### 1. Deploy Your Backend Server

First, you need to deploy your backend server to a hosting platform. Popular options include:

**Heroku:**
```bash
# In your cedi-loan-backend directory
heroku create your-app-name
git add .
git commit -m "Deploy backend"
git push heroku main
```

**Railway:**
```bash
# Connect your GitHub repo to Railway
# Railway will auto-deploy from your repository
```

**DigitalOcean App Platform:**
- Connect your GitHub repository
- Configure build and run commands
- Deploy automatically

**AWS/Google Cloud/Azure:**
- Use their respective app hosting services

#### 2. Update Environment Variables

Once your backend is deployed, you'll get a URL like:
- `https://your-app-name.herokuapp.com`
- `https://your-app-name.railway.app`
- `https://your-backend-domain.com`

#### 3. Configure Frontend for Production

**Option A: Update .env.production (Recommended)**

I've created `.env.production` for you. Update the `REACT_APP_API_URL` with your actual backend URL:

```env
REACT_APP_API_URL=https://your-actual-backend-url.com/api
```

**Option B: Set Environment Variables in Your Hosting Platform**

If using Vercel, Netlify, or similar:
1. Go to your project settings
2. Add environment variable: `REACT_APP_API_URL`
3. Set value to: `https://your-backend-url.com/api`

#### 4. Rebuild and Redeploy Frontend

After updating the API URL:
```bash
npm run build
# Then deploy the build folder to your hosting platform
```

### Testing Locally with Production Settings

To test the production configuration locally:

```bash
# Build with production environment
NODE_ENV=production npm run build

# Or create a .env.local file with production API URL
echo "REACT_APP_API_URL=https://your-backend-url.com/api" > .env.local
npm start
```

### Backend Deployment Checklist

- [ ] Backend deployed and accessible via HTTPS
- [ ] Environment variables configured on backend hosting platform
- [ ] Database connection working in production
- [ ] CORS configured to allow your frontend domain
- [ ] API endpoints responding correctly

### Frontend Deployment Checklist

- [ ] `REACT_APP_API_URL` updated with production backend URL
- [ ] Frontend built with production environment
- [ ] Frontend deployed to hosting platform
- [ ] Environment variables set in hosting platform
- [ ] Test all API calls work from hosted frontend

### Common Hosting Platforms

**Backend Hosting:**
- Heroku (Free tier available)
- Railway (Free tier available)
- DigitalOcean App Platform
- AWS Elastic Beanstalk
- Google Cloud Run

**Frontend Hosting:**
- Vercel (Free for personal projects)
- Netlify (Free tier available)
- GitHub Pages
- Firebase Hosting
- AWS S3 + CloudFront

### Troubleshooting

1. **Still getting connection errors?**
   - Check if backend URL is accessible in browser
   - Verify CORS settings in backend
   - Check browser network tab for actual URL being called

2. **API calls working locally but not in production?**
   - Ensure environment variables are set correctly
   - Check if using HTTP vs HTTPS (mixed content issues)
   - Verify backend is running and accessible

3. **Environment variables not working?**
   - Restart your development server after changing .env
   - Rebuild your app for production
   - Check hosting platform environment variable settings

### Next Steps

1. Deploy your backend to a hosting platform
2. Get the backend URL
3. Update `.env.production` with the correct URL
4. Rebuild and redeploy your frontend
5. Test the work info update functionality

### Need Help?

If you need assistance with:
- Choosing a hosting platform
- Deploying your backend
- Configuring environment variables
- Testing the deployment

Please provide:
1. Which hosting platform you prefer
2. Your backend deployment URL (once deployed)
3. Any specific error messages you encounter