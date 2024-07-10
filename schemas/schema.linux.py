import json
import os

import yaml


def process_matrix(file_path):
    with open(
        file_path
    ) as matrix:  # Using with is a good practice as it automatically closes the file
        matrix_data = json.load(matrix)

    schema_object_array = []
    for item in matrix_data:
        if item["osDistro"] != "windows-server":
            schema_object = {
                "src": item["targetPackageName"],
                "arch": [item["pkgArch"]],
                "uploads": [
                    {
                        "type": item["packageManagerType"],
                        "dest": item["uploadDest"],
                        "os_version": [item["osVersion"]],
                    }
                ],
            }
            if "srcRepo" in item:
                schema_object["uploads"][0]["src_repo"] = item["srcRepo"]
            schema_object_array.append(schema_object)

    return schema_object_array


if __name__ == "__main__":
    nria_env = os.environ.get("NRIA_ENV")
    schema_object_array = []

    if nria_env == "staging":
        schema_object_array = process_matrix("../versions/stagingMatrix.json")
    elif nria_env == "production":
        schema_object_array = process_matrix("../versions/productionMatrix.json")

    format = os.environ.get("FORMAT")
    if format == "yaml":
        print(yaml.dump(schema_object_array))
    elif format == "json":
        print(json.dumps(schema_object_array))
