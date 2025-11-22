# Use Node.js 18 LTS as base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY backend/package*.json ./backend/

# Install dependencies (install all, not just production, to ensure everything works)
WORKDIR /app/backend
RUN npm install

# Copy the rest of the application
WORKDIR /app
COPY . .

# Expose port (Railway will set PORT env var)
EXPOSE 3000

# Start the application
WORKDIR /app/backend

# Use node directly instead of npm to avoid npm wrapper issues
CMD ["node", "server.js"]

