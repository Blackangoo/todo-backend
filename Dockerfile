FROM node:lts
WORKDIR /usr/src/app
COPY . .
RUN npm i
CMD node code/index.js
