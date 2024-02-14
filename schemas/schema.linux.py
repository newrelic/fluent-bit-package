import json
import yaml

if __name__ == '__main__':
    matrix = open('../versions/strategyMatrix.json')
    matrixData = json.load(matrix)
    schemaObjectArray = []
    for item in matrixData:
        if item['osDistro'] != 'windows-server':
            schemaObject = {
                'src': item['targetPackageName'],
                'arch': [item['pkgArch']],
                'uploads': [
                    {
                        'type': item['packageManagerType'],
                        'dest': item['uploadDest'],
                        'os_version': [item['osVersion']]
                    }
                ]
            }
            if "srcRepo" in item:
                schemaObject['uploads'][0]['src_repo'] = item['srcRepo']

            schemaObjectArray.append(schemaObject)

    matrix.close()
    print(yaml.dump(schemaObjectArray))
