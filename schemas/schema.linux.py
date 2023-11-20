import json
import yaml

if __name__ == '__main__':
    matrix = open('../versions/strategyMatrix.json')
    matrixData = json.load(matrix)
    schemaObjectArray = []
    for item in matrixData:
        if item['osDistro'] != 'windows-server':
            src = item['targetPackageName']
            type = item['packageManagerType']
            arch = item['repoArch']
            os_version = item['osVersion']
            schemaObject = {
                'src': src,
                'arch': [arch],
                'uploads': [
                    {
                        'type': type,
                        'src_repo': '{access_point_host}/infrastructure_agent/linux/' + type,
                        'dest': '{dest_prefix}linux/' + type + '/',
                        'os_version': [os_version]
                    }
                ]
            }
            schemaObjectArray.append(schemaObject)

    matrix.close()
    print(yaml.dump(schemaObjectArray))
