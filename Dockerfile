FROM python:3.10.2-alpine

ARG requirements=requirements/production.txt
ARG DBGR_SERVER_VERSION="1.1.0-dev1"
ARG DBGR_VERSION="3.3.0"

RUN \
    apk add --no-cache --virtual .build-deps build-base linux-headers && \
    python3 -m pip install dbgr-server==$DBGR_SERVER_VERSION && \
    python3 -m pip install dbgr==$DBGR_VERSION && \
    apk --purge del .build-deps

EXPOSE 19840
EXPOSE 1984
CMD ["dbgr.server.py", "--server-host=0.0.0.0", "--socket-host=0.0.0.0", "--detached_session"]
