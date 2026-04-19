# MessFlow Admin App

This repository contains the MessFlow Admin application built with React, Vite, and Firebase.

## Prerequisites

- Node.js (version 18+ recommended)
- `npm` or `pnpm` depending on your preference.

## Setup Instructions

Follow these steps to set up the project locally after cloning the repository (`git pull`).

1. **Install Dependencies**
   Navigate to the project directory and install the required dependencies:
   ```bash
   npm install
   ```

2. **Environment Variables**
   Create a `.env.local` file in the root directory and add your Firebase configuration:
   ```env
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   ```

3. **Run the Development Server**
   Start the local development server to run the application:
   ```bash
   npm run dev
   ```

4. **Build for Production (Optional)**
   To create a production build of the application:
   ```bash
   npm run build
   ```

## Technologies Used

- React 18
- Vite
- Firebase
- Tailwind CSS
- Radix UI
- Lucide React (Icons)