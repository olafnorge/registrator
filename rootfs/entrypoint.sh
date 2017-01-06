#!/usr/bin/env sh

if [ "$1" = 'registrator' ]; then
  addgroup -g $(stat -c "%g" /var/run/docker.sock) -S docker \
  && adduser registrator docker \
  && exec su-exec registrator node index.js --consul ${CONSUL_HOST}:8500 > /proc/self/fd/2
fi

exec su-exec registrator "$@"

