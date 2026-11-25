# Use the official Node.js 22 image as the base image
FROM node:22.23.4-alpine

# Set the working directory inside the container and hand it to the
# unprivileged "node" user that ships with the image
WORKDIR /app
RUN chown node:node /app
USER node

# Install the exact dependency tree from the lockfile (dev dependencies
# included: the build needs TypeScript)
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci

# Copy the rest of the application code
COPY --chown=node:node . .

# Build the Next.js application, then drop dev dependencies
RUN npm run build && npm prune --omit=dev

# Expose the port the app runs on
EXPOSE 3000

# Set the environment to production
ENV NODE_ENV=production

# Start the application
CMD ["npm", "start"]
