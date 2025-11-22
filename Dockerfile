# Use Node.js 18 LTS as base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY backend/package*.json ./backend/

# Install dependencies
WORKDIR /app/backend
RUN npm install --production

# Copy the rest of the application
WORKDIR /app
COPY . .

# Expose port (Railway will set PORT env var)
EXPOSE 3000

# Start the application
WORKDIR /app/backend
CMD ["npm", "start"]

