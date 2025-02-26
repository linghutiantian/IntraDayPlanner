### Preview

[https://catlendar.online/](https://catlendar.online/)

### Install dependencies:

```
npm install
```


### Run the development server:

```
npm run dev
```

The app should now be running at http://localhost:5173 (or similar port).
To deploy the app, you have several options:

### Deploy to Vercel (Easiest):

```
npm install -g vercel
vercel login
vercel
```

### Deploy to Netlify:


Create a Netlify account
Install Netlify CLI: `npm install -g netlify-cli`
Run: `netlify deploy`


### Deploy to GitHub Pages:
a. Install gh-pages:

```
npm install gh-pages --save-dev
```

b. Deploy:
```
npm run deploy
```

### Build for production locally:

```
npm run build
```

This will create a dist folder that you can deploy to any static hosting service.


# Google Calendar Integration Setup

This guide walks you through setting up Google Calendar integration for the day planner application.

## For Project Owners / Developers

### 1. Create a Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. From the navigation menu, go to "APIs & Services" > "Library"
4. Search for "Google Calendar API" and enable it

### 2. Configure OAuth Consent Screen

1. Go to "APIs & Services" > "OAuth consent screen"
2. Select "External" user type (unless you're using Google Workspace)
3. Fill in the required app information:
   - App name
   - User support email
   - Developer contact information
4. Add the following scope: `https://www.googleapis.com/auth/calendar.readonly`
5. Add test users if you're still in testing mode

### 3. Create Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. Select "Web application" as the application type
4. Add authorized JavaScript origins:
   - For development: `http://localhost:5173` (or your Vite dev server port)
   - For production: Your domain name
5. No need to add redirect URIs as we're using the Google Sign-In button
6. Create the OAuth client ID
7. Note your Client ID

### 4. Create API Key

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "API Key"
3. Restrict the API key to only the Google Calendar API
4. Consider adding HTTP referrer restrictions for better security
5. Note your API Key

### 5. Configure Environment Variables

1. Create a `.env` file in the root of your project (same level as `vite.config.js`)
2. Add these variables:
   ```
   VITE_GOOGLE_CLIENT_ID=your_client_id_here
   VITE_GOOGLE_API_KEY=your_api_key_here
   ```
3. Add `.env` to your `.gitignore` file

### 6. For Production Deployment

When deploying to production:

1. Create a `.env.production` file with your production credentials
2. Configure environment variables in your hosting platform:
   - Vercel: Add in the project settings under "Environment Variables"
   - Netlify: Add in site settings under "Build & Deploy" > "Environment"
   - Other platforms: Refer to their documentation

## For Users

1. Click on the settings gear icon in the day planner
2. Find the "Google Calendar" section
3. Click "Connect Google Calendar"
4. Sign in with your Google account when prompted
5. Review and accept the permissions request
6. Once connected, click "Import Today's Events" to add your calendar events to the planner

Note: The application only requests read-only access to your calendar. It cannot modify your Google Calendar events.