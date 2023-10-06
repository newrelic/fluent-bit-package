const fs = require("fs");
const path = require('path');
const xml2js = require("xml2js");
const {mergeFiles} = require('junit-report-merger');

const processResult = (reportsFolder, fileName) => {
    // sample fileName; fluent-bit_2.0.8_debian-bullseye_amd64.deb.xml
    const parser = new xml2js.Parser();
    const runtimeId = path.parse(fileName).name;
    const runtimeProperties = runtimeId.split('_');
    const data = fs.readFileSync(`${reportsFolder}/${fileName}`);
    parser.parseString(data, function (err, result) {
        const properties = [
            {
                "$": {name: "fb_version", value: runtimeProperties[0]}
            },
            {
                "$": {name: "os_distro", value: runtimeProperties[1]}
            },
            {
                "$": {name: "os_version", value: runtimeProperties[2]}
            },
            {
                "$": {name: "arch", value: runtimeProperties[3]}
            },
        ]
        const suiteName = properties
            .map((prop) => `${prop.$.name}=${prop.$.value}`)
            .join(" ");
        const finalSuite = {
            $: {
                name: suiteName,
                errors: 0,
                failures: 0,
                skipped: 0,
                tests: 0,
                time: result.testsuites.$.time,
                timestamp: result.testsuites.testsuite[0].$.timestamp,
            },
            properties,
            testcase: [],
        };
        result.testsuites.testsuite.forEach((suite) => {
            finalSuite.testcase = finalSuite.testcase.concat(suite.testcase);
            finalSuite.$.errors += parseInt(suite.$.errors) || 0;
            finalSuite.$.failures += parseInt(suite.$.failures) || 0;
            finalSuite.$.skipped += parseInt(suite.$.skipped) || 0;
            finalSuite.$.tests += parseInt(suite.$.tests) || 0;
        });
        result.testsuites.testsuite = [finalSuite];
        const builder = new xml2js.Builder();
        const xml = builder.buildObject(result);
        fs.writeFileSync(`${reportsFolder}/${fileName}`, xml);
    });
}

const mergeResults = async (path, reportName) => {
    const outputFile = `${path}/${reportName}`;
    const inputFiles = [];
    fs.readdirSync(path)
        .filter(file => file !== reportName)
        .forEach(file => inputFiles.push(`${path}/${file}`));

    await mergeFiles(outputFile, inputFiles);
}

(async () => {
    const resultsFolder = process.env.TEST_REPORT_ROOT_PATH;
    const testReportName = process.env.TEST_REPORT_NAME;
    fs.readdirSync(resultsFolder)
        .filter(file => file !== testReportName)
        .forEach(file => {
            processResult(resultsFolder, file);
        });
    await mergeResults(resultsFolder, testReportName);
})();
