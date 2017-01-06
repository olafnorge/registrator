FROM alpine:3.5
MAINTAINER Volker Machon <volker@machon.biz>

RUN mkdir -p /opt/registrator \
      && [ $(getent group registrator) ] || addgroup -S registrator \
      && [ $(getent passwd registrator) ] || adduser -h /opt/registrator -S -D -G registrator registrator \
      && apk add --no-cache \
             ca-certificates \
             nodejs

COPY rootfs/ /

RUN chown -R registrator.registrator /opt/registrator

USER registrator
WORKDIR /opt/registrator
RUN npm install

CMD ["node", "index.js", "--consul", "${CONSUL_HOST}:8500", ">", "/proc/self/fd/2"]
