# Tutor Availability & Demo Booking System

A complete production-ready web application for managing tutor scheduling, availability, and demo class bookings with full transparency.

## Phase 1: Project Setup

### What's Complete
- Express.js backend initialized
- MongoDB connection configured
- Environment variables setup
- Clean folder structure created
- Basic server with health check route
- Frontend foundation with HTML, CSS, JavaScript

### Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Update `.env` with your MongoDB URI and other configurations

5. Start the development server:
```bash
npm run dev
```

6. Open browser and navigate to `http://localhost:5000`

### API Endpoints

- `GET /api/health` - Health check endpoint

### Folder Structure

```
Acheduler/
  config/
    database.js         # MongoDB connection
  controllers/         # Route controllers (future phases)
  middleware/          # Custom middleware (future phases)
  models/             # Database models (future phases)
  routes/             # API routes (future phases)
  utils/              # Utility functions (future phases)
  public/
    css/
      style.css        # Main stylesheet
    js/
      main.js          # Main JavaScript file
    index.html         # Main HTML page
  .env.example         # Environment variables template
  .gitignore          # Git ignore file
  package.json        # Dependencies and scripts
  server.js           # Main server file
```

### Next Steps

Phase 2: Authentication System
- User roles (tutor, sales, admin)
- Register/Login APIs
- JWT authentication
- Role-based access control

## Development Commands

```bash
npm start          # Start production server
npm run dev        # Start development server with nodemon
npm test           # Run tests (to be implemented)
```
