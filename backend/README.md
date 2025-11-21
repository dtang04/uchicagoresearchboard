# UChicago Research Board - Backend API

Backend server for the UChicago Research Board application.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

The server will run on `http://localhost:3001`

## API Endpoints

### POST /api/trending-labs
Get trending labs for a department.

**Request Body:**
```json
{
  "department": "statistics"
}
```

**Response:**
```json
{
  "trendingLabs": ["Xiu Lab", "Anitescu Lab", "Barber Group"],
  "department": "statistics",
  "lastUpdated": "2024-01-01T00:00:00.000Z"
}
```

### PUT /api/trending-labs
Update trending labs for a department.

**Request Body:**
```json
{
  "department": "statistics",
  "trendingLabs": ["Xiu Lab", "Anitescu Lab"]
}
```

### GET /api/health
Health check endpoint.

## Database

Uses SQLite (`database.db`) for storage. The database includes:
- Departments and professors/labs data
- Trending labs per department
- Analytics tracking (views and clicks)

To migrate from the old JSON format, run:
```bash
node scripts/migrate.js
```

## Future Enhancements

- Replace JSON file with proper database
- Add authentication
- Add lab website scraping functionality
- Add caching layer
- Add rate limiting

