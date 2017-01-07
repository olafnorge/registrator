#!/usr/bin/env sh

if [ "$1" = 'registrator' ]; then
  shift
  [ $(getent group docker) ] || addgroup -g $(stat -c "%g" /var/run/docker.sock) -S docker \
    && adduser registrator docker \
    && exec su-exec registrator node index.js "$@" > /proc/self/fd/2
fi

exec su-exec registrator "$@"
