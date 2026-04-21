FROM node:22-alpine

# Install docker CLI so that we can potentially use it, though dockerode uses the socket directly
# Also install bash and curl for general utility
RUN apk add --no-cache docker-cli bash curl

# Set the working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install all dependencies (including devDependencies needed for vite build and tsx)
RUN npm install

# Copy the rest of the application
COPY . .

# Build the frontend assets
RUN npm run build

# Expose the application port
EXPOSE 3000

# Start the application in production mode
CMD ["npm", "run", "start"]
