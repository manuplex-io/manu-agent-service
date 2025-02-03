# Use the latest Node.js image
FROM node:latest

# Install Python, pip, and PostgreSQL client
RUN apt-get update && \
    apt-get install -y \
    python3 \
    python3-pip \
    postgresql-client && \
    rm -rf /var/lib/apt/lists/*
# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Copy the entrypoint and cleanup scripts
COPY entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/entrypoint.sh

# Build the application (if using TypeScript)
RUN npm run build

# Expose the port the app runs on
EXPOSE 3000

# Command to run the application
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
# CMD ["npm", "run", "start:prod"]