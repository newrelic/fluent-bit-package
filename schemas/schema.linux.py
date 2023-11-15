import json
import yaml

if __name__ == '__main__':
    matrix = open('../versions/strategyMatrix.json')
    matrixData = json.load(matrix)
    schemaObjectArray = []
    for item in matrixData:
        if item['osDistro'] != 'windows-server':
            type = item['nrPackageUrl'].split('/')[5]
            arch = 'arm64' if (item['arch'] == 'aarch64') else item['arch']
            schemaObject = {
                'src': item['targetPackageName'],
                'arch': [
                    arch
                ],
                'uploads': [
                    {
                        'type': type,
                        'src_repo': '{access_point_host}/infrastructure_agent/linux/' + type,
                        'dest': '{dest_prefix}linux/' + type + '/',
                        'os_version': [
                            item['osVersion']
                        ]
                    }
                ]
            }
            schemaObjectArray.append(schemaObject)

    matrix.close()
    print(yaml.dump(schemaObjectArray))
