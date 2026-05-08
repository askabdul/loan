# Firebase Authentication Setup Guide

## Common Issues and Solutions

### Issue: `auth/invalid-app-credential` Error

This error commonly occurs when using Firebase Phone Authentication in development environments. Here are the solutions:

#### Solution 1: Use 127.0.0.1 instead of localhost

**Problem**: Google has changed their policy and localhost is no longer supported for phone authentication in development.

**Solution**: 
1. Instead of accessing your app at `http://localhost:3000`
2. Use `http://127.0.0.1:3000`
3. Make sure to authorize this domain in Firebase Console (see steps below)

#### Solution 2: Authorize Domains in Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (`quickmula`)
3. Navigate to **Authentication** > **Settings** > **Authorized domains**
4. Add the following domains:
   - `127.0.0.1` (for local development)
   - `localhost` (backup, though may not work for phone auth)
   - Your production domain (if deployed)

#### Solution 3: Verify Firebase Configuration

Ensure your `.env` file contains the correct Firebase configuration:

```env
REACT_APP_FIREBASE_API_KEY=your_api_key_here
REACT_APP_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id
```

#### Solution 4: Enable Phone Authentication

1. In Firebase Console, go to **Authentication** > **Sign-in method**
2. Enable **Phone** authentication
3. Configure your phone number for testing (optional)

### Testing Phone Numbers

For development and testing, you can use Firebase's test phone numbers:

1. Go to **Authentication** > **Sign-in method** > **Phone**
2. Add test phone numbers with verification codes
3. Example: `+1 650-555-3434` with code `123456`

### Development Workflow

1. **Start your development server**:
   ```bash
   npm start
   ```

2. **Access your app using 127.0.0.1**:
   ```
   http://127.0.0.1:3000
   ```

3. **Test phone authentication** with either:
   - Real phone numbers (if properly configured)
   - Test phone numbers (recommended for development)

### Troubleshooting

#### Error: "Firebase configuration is incomplete"
- Check that all environment variables are set in `.env`
- Restart your development server after changing `.env`

#### Error: "reCAPTCHA verification failed"
- Ensure your domain is authorized in Firebase Console
- Try using 127.0.0.1 instead of localhost
- Check browser console for additional reCAPTCHA errors

#### Error: "SMS quota exceeded"
- You've reached Firebase's SMS limit for the day
- Use test phone numbers for development
- Wait 24 hours or upgrade your Firebase plan

### Production Deployment

When deploying to production:

1. Add your production domain to Firebase authorized domains
2. Ensure all environment variables are set in your hosting platform
3. Test phone authentication thoroughly before going live

### Additional Resources

- [Firebase Phone Auth Documentation](https://firebase.google.com/docs/auth/web/phone-auth)
- [Firebase Console](https://console.firebase.google.com/)
- [Firebase Auth Error Codes](https://firebase.google.com/docs/reference/js/auth#autherrorcodes)