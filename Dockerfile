# MIT License
#
# Copyright (c) [2017] [Volker Machon]
#
# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:
#
# The above copyright notice and this permission notice shall be included in all
# copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
# SOFTWARE.

FROM alpine:3.5
MAINTAINER Volker Machon <volker@machon.biz>

COPY rootfs/ /
WORKDIR /opt/registrator
RUN mkdir -p /opt/registrator \
      && [ $(getent group registrator) ] || addgroup -S registrator \
      && [ $(getent passwd registrator) ] || adduser -h /opt/registrator -S -D -G registrator registrator \
      && apk add --no-cache \
             ca-certificates \
             nodejs \
             su-exec \
      && npm install \
      && apk del \
             ca-certificates \
      && chown -R registrator.registrator /opt/registrator

ENTRYPOINT ["/entrypoint.sh"]
CMD ["registrator"]
