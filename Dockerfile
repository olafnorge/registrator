FROM alpine:3.5
MAINTAINER Volker Machon <volker@machon.biz>

COPY rootfs/ /
WORKDIR /opt/registrator
RUN mkdir -p /opt/registrator \
      && [ $(getent group registrator) ] || addgroup -S registrator \
      && [ $(getent passwd registrator) ] || adduser -h /opt/registrator -S -D -G registrator registrator \
      && npm install \
      && chown -R registrator.registrator /opt/registrator \
      && apk add --no-cache \
             ca-certificates \
             nodejs \
             su-exec

ENTRYPOINT ["/entrypoint.sh"]
CMD ["registrator"]
