#!/bin/bash

set -e

if [ ! -d "/srv/fluent-bit-package" ]; then
    printf "Repository was not properly mounted. Mount it at /srv/fluent-bit-package\n" >&2
    exit 1
fi

if [ -z "${AWS_ACCESS_KEY_ID}" ]; then
    printf "AWS_ACCESS_KEY_ID env variable is empty\n" >&2
    exit 1
fi

if [ -z "${AWS_SECRET_ACCESS_KEY}" ]; then
    printf "AWS_SECRET_ACCESS_KEY env variable is empty\n" >&2
    exit 1
fi

if [ -z "${AWS_SESSION_TOKEN}" ]; then
    printf "AWS_SESSION_TOKEN env variable is empty\n" >&2
    exit 1
fi

# To avoid running terraform apply/destroy on the volume, which would save the state locally
cd /srv
cp -R fluent-bit-package fluent-bit-package-copy
cd fluent-bit-package-copy

mkdir -p "${ANSIBLE_INVENTORY_FOLDER}"

make "${@}"