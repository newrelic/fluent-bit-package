const fs = require("fs");
const path = require('path');
const xml2js = require("xml2js");
const { mergeFiles } = require('junit-report-merger');

const processResult = async (filePath) => {
    const parser = new xml2js.Parser();
    const runtimeId = path.parse(filePath).name;
    console.log(filePath)
    fs.readFile(filePath, async (err, data) => {
        parser.parseString(data, async function (err, result) {
            console.log(runtimeId);
            const runtimeProperties = runtimeId.split("-");
            const properties = [
                {
                    "$": {name: "os_distro", value: runtimeProperties[0]}
                },
                {
                    "$": {name: "os_version", value: runtimeProperties[1]}
                },
                {
                    "$": {name: "arch", value: runtimeProperties[2]}
                },
                {
                    "$": {name: "fb_version", value: runtimeProperties[3]}
                }
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
            fs.writeFileSync(filePath, xml);
        });
    });
}

const mergeResults = async (path) => {
    const outputFile = `${path}/report.xml`;
    const inputFiles = [`${path}/*.xml`];

    await mergeFiles(outputFile, inputFiles);
}

(async () => {
    // setUpNodeJs();
    const resultsFolder = process.env.TEST_REPORT_ROOT_PATH;
    console.log(resultsFolder);
    await fs.readdir(resultsFolder, (err, files) => {
        files.forEach(file => {
            processResult(`${resultsFolder}/${file}`);
        });
    });
    // await giveWinstonTimeToFlush();
    await mergeResults(resultsFolder);
    // await exec('npm run html:report');
    // exit(passed ? ExitCodes.SUCCESS : ExitCodes.ERROR);
})();
