FROM node:22-alpine
WORKDIR /app
RUN echo "BUILD-$(date +%s)" && mkdir -p /app/auth_info
COPY package*.json ./
RUN npm install
COPY . .
CMD ["npm", "start"]
