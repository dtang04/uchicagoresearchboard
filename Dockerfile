# Use Node.js 18 LTS as base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm install

# Copy the rest of the application
WORKDIR /app
COPY . .

# Expose port (Render sets PORT env var)
EXPOSE 10000

# Start the application
WORKDIR /app/backend
CMD ["node", "server.js"]

