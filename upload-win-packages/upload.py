import logging
import boto3
from botocore.exceptions import ClientError
import os
import urllib.request
from github import Github
from github import Auth


def download_win_packages_from_gh_release(token, tag_name):
    auth = Auth.Token(token)
    fluent_bit_package_repo = Github(auth).get_repo('newrelic/fluent-bit-package').get_releases()
    asset_names = []

    for release in fluent_bit_package_repo:
        if release.tag_name == tag_name:
            for asset in release.get_assets():
                if "windows" in asset.name:
                    urllib.request.urlretrieve(asset.url, asset.name)
                    asset_names.append(asset.name)

    return asset_names

def upload_file(file_name, bucket):
    s3_client = boto3.client('s3')
    try:
        s3_client.upload_file(file_name, bucket, None)
    except ClientError as e:
        logging.error(e)

if __name__ == "__main__":
    asset_names = download_win_packages_from_gh_release(os.environ['GITHUB_TOKEN'], os.environ['REF'])
    for asset_name in asset_names:
        upload_file(asset_name, 'logging-fb-windows-packages')
