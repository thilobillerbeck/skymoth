FROM node:18
WORKDIR /app
COPY . .
RUN npm install
RUN npm run tailwind:build
RUN npm run generate
RUN npm run build
ENV NODE_ENV=production
EXPOSE 3000
ENV ADDRESS=0.0.0.0 PORT=3000
CMD npm start