#!/bin/bash
set -e
#
#
# Upload artifacts to GH Release assets
#
#
cd packages
for filename in $(find  -regex ".*\.\(rpm\|deb\|zip\)");do
  echo "===> Uploading to GH $VERSION: ${filename}"
      gh release upload --clobber $VERSION $filename
done
