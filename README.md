# College Event Management

A full-stack college event management system with a React + Vite frontend and a Node.js/Express + MongoDB backend.

## Project Structure

- `src/` contains the frontend application
- `Server/` contains the backend API and realtime features

## Setup

### Frontend

```bash
npm install
npm run dev
```

### Backend

1. Install backend dependencies:

```bash
cd Server
npm install
```

2. Create `Server/.env` using `Server/.env.example` as a template.

3. Start MongoDB locally or update `MONGODB_URI` to your hosted MongoDB instance.

4. Start the backend:

```bash
node index.js
```

## Environment Variables

Create `Server/.env` with values like:

```env
PORT=3001
MONGODB_URI=mongodb://localhost:27017/CEM
JWT_SECRET=replace_this_with_a_long_random_secret
```

## Public Repository Safety

This repository is configured to ignore:

- `node_modules`
- build output such as `dist`
- `Server/uploads`
- local `.env` files
- logs and local database files

Do not commit real secrets. Keep them only in `Server/.env`.
