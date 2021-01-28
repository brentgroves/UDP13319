FROM node:14-alpine

# Semantic Version: Major.Minor.Patch
# Version: 1.0.0

# Add wait-for-it
# I am not sure whether or not to make the owner node.  Don't know if node user has enough 
# permisssions to run it.  It is ran from docker-compose yaml.
# COPY wait-for-it.sh /wait-for-it.sh
# RUN chmod +x /wait-for-it.sh
# https://medium.com/@marcelorlima/how-to-easily-make-your-container-waits-for-another-one-to-get-up-with-dockerize-be392e4e8e23
RUN mkdir -p /usr/src/app
RUN apk add --no-cache openssl

# Create app directory
WORKDIR /usr/src/app

ENV DOCKERIZE_VERSION v0.6.1
RUN wget https://github.com/jwilder/dockerize/releases/download/$DOCKERIZE_VERSION/dockerize-alpine-linux-amd64-$DOCKERIZE_VERSION.tar.gz \
    && tar -C /usr/local/bin -xzvf dockerize-alpine-linux-amd64-$DOCKERIZE_VERSION.tar.gz \
    && rm dockerize-alpine-linux-amd64-$DOCKERIZE_VERSION.tar.gz


# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

RUN npm install

# Bundle app source
COPY . .

EXPOSE 2222/udp

# I think this cmd gets overriden by the docker compose yaml script.
CMD dockerize -wait tcp://db:3306 -wait tcp://mqtt2:1883 node app.js
# CMD [ "node", "app.js" ]