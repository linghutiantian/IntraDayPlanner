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