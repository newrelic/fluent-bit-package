#!/usr/bin/env sh
set -e
#
#
#
# TEST ONLY debug (runs before ~/.rpmmacros is written, so no secrets are printed)
echo "===> DEBUG rpm environment"
rpm --version || true
id || true
grep -rn "__gpg_sign_cmd\|__plaintext_filename\|__signature_filename" /usr/lib/rpm/macros /usr/lib/rpm/macros.d 2>/dev/null | cut -c1-300 || true
rpm --eval '%{__gpg_sign_cmd}' || true
rpm --eval '%{_gpg_path} %{_gpgbin}' || true
dpkg -l | grep -iE "^ii +(rpm|gnupg|gpg|sequoia|librpm)" | cut -c1-120 || true
echo "===> END DEBUG"

# Sign RPM's & DEB's in /packages to GH Release Assets
#
#
#

# Sign RPM's
echo "===> Create .rpmmacros to sign rpm"
echo "%_gpg_name ${GPG_MAIL}" >> ~/.rpmmacros
echo "%_signature gpg" >> ~/.rpmmacros
echo "%_gpg_path /home/runner/.gnupg" >> ~/.rpmmacros
echo "%_gpgbin /usr/bin/gpg" >> ~/.rpmmacros
# rpm >= 6 (ubuntu 26.04) replaced the %__gpg_sign_cmd placeholders with positional args (%1 = file to sign, %2 = signature)
RPM_MAJOR=$(rpm --version | awk '{print $NF}' | cut -d. -f1)
if [ "${RPM_MAJOR}" -ge 6 ]; then
  echo "%__gpg_sign_cmd() %{shescape:%{__gpg}} --no-verbose --no-armor --batch --pinentry-mode loopback --passphrase ${GPG_PASSPHRASE} --no-secmem-warning -u '%{_gpg_name}' -sbo '%{2}' -- '%{1}'" >> ~/.rpmmacros
else
  echo "%__gpg_sign_cmd   %{__gpg} gpg --no-verbose --no-armor --batch --pinentry-mode loopback --passphrase ${GPG_PASSPHRASE} --no-secmem-warning -u "%{_gpg_name}" -sbo %{__signature_filename} %{__plaintext_filename}" >> ~/.rpmmacros
fi

echo "===> Importing GPG private key from GHA secrets..."
printf %s ${GPG_PRIVATE_KEY_BASE64} | base64 -d | gpg --batch --import -

echo "===> Importing GPG signature, needed to verify signature"
curl -fsSL https://download.newrelic.com/infrastructure_agent/gpg/newrelic-infra-sha256.gpg -o /tmp/RPM-GPG-KEY-${GPG_MAIL}
sudo rpm --import /tmp/RPM-GPG-KEY-${GPG_MAIL}

cd packages

for rpm_file in $(find -regex ".*\.\(rpm\)");do
  echo "===> Signing $rpm_file"
  rpm --addsign $rpm_file
  echo "===> Sign verification $rpm_file"
  rpm -v --checksig $rpm_file
done

# Sign DEB's
GNUPGHOME="/home/runner/.gnupg"
echo "${GPG_PASSPHRASE}" > "${GNUPGHOME}/gpg-passphrase"
echo "passphrase-file ${GNUPGHOME}/gpg-passphrase" >> "$GNUPGHOME/gpg.conf"
echo 'allow-loopback-pinentry' >> "${GNUPGHOME}/gpg-agent.conf"
echo 'pinentry-mode loopback' >> "${GNUPGHOME}/gpg.conf"
echo 'use-agent' >> "${GNUPGHOME}/gpg.conf"
echo RELOADAGENT | gpg-connect-agent

for deb_file in $(find -regex ".*\.\(deb\)");do
  echo "===> Signing $deb_file"
  debsigs --sign=origin --verify --check -v -k ${GPG_MAIL} $deb_file
done
