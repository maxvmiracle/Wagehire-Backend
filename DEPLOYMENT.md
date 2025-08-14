# Deployment Guide for Render

## Prerequisites
- A Render account
- Your code pushed to a Git repository (GitHub, GitLab, etc.)

## Deployment Steps

### 1. Connect to Render
1. Go to [render.com](https://render.com) and sign in
2. Click "New +" and select "Web Service"
3. Connect your Git repository

### 2. Configure the Service
- **Name**: `wagehire-backend` (or your preferred name)
- **Environment**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Plan**: Choose the plan that fits your needs

### 3. Environment Variables
Add these environment variables in the Render dashboard:
- `NODE_ENV`: `production`
- `PORT`: `10000` (or let Render assign one automatically)

### 4. Deploy
Click "Create Web Service" and wait for the deployment to complete.

## Important Notes

### Database
- The application uses SQLite with `better-sqlite3` which is compatible with Render
- In production, the database will be in-memory (as configured in `database/connection.js`)
- **Important**: Data will be lost when the service restarts since it's using in-memory storage
- For persistent data, consider using a PostgreSQL database service on Render

### Environment Variables
Make sure to set up any additional environment variables your application needs:
- Email configuration (SMTP settings)
- JWT secrets
- Any API keys

### Troubleshooting
If you encounter issues:
1. Check the build logs in Render dashboard
2. Ensure all dependencies are properly listed in `package.json`
3. Verify that the start command (`npm start`) works locally

## Local Testing
Before deploying, test locally:
```bash
npm install
npm start
```

## Database Migration
If you need to migrate from the old sqlite3 to better-sqlite3:
1. The database schema remains the same
2. No data migration is needed if using in-memory database
3. If using file-based database, the existing `.db` file should work with better-sqlite3 