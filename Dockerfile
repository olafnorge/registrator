FROM alpine:3.5
MAINTAINER Volker Machon <volker@machon.biz>

RUN mkdir -p /opt/registrator \
      && [ $(getent group registrator) ] || addgroup -S registrator \
      && [ $(getent passwd registrator) ] || adduser -h /opt/registrator -S -D -G registrator registrator \
      && apk add --no-cache \
             ca-certificates \
             nodejs \
             su-exec

COPY rootfs/ /

WORKDIR /opt/registrator
RUN npm install
RUN chown -R registrator.registrator /opt/registrator

ENTRYPOINT ["/entrypoint.sh"]
CMD ["registrator"]
