FROM node:22-alpine
WORKDIR /app
RUN mkdir -p /app/auth_info
COPY package*.json ./
RUN npm install
COPY . .
CMD ["npm", "start"]
