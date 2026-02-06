const fs = require("fs");
const path = require('path');
const xml2js = require("xml2js");
const { mergeFiles } = require('junit-report-merger');

const validateXmlFile = (filePath) => {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        if (!data || data.trim().length === 0) {
            console.warn(`WARNING: Empty file: ${filePath}`);
            return false;
        }
        // Basic XML structure check
        if (!data.includes('<?xml') && !data.includes('<testsuites')) {
            console.warn(`WARNING: File doesn't appear to be valid XML: ${filePath}`);
            return false;
        }
        return true;
    } catch (err) {
        console.error(`ERROR: Cannot read file ${filePath}: ${err.message}`);
        return false;
    }
};

const processResult = (reportsFolder, fileName) => {
    // sample fileName; fluent-bit_2.0.8_debian-bullseye_amd64.deb.xml
    // or partial report: test-report-linux-prerelease-apt.xml
    const parser = new xml2js.Parser();
    const runtimeId = path.parse(fileName).name;
    const runtimeProperties = runtimeId.split('_');
    
    // Skip partial merged reports (they have different naming)
    if (runtimeProperties.length < 4) {
        console.log(`Skipping partial report file: ${fileName}`);
        return;
    }
    
    const filePath = `${reportsFolder}/${fileName}`;
    if (!validateXmlFile(filePath)) {
        console.warn(`Skipping invalid file: ${fileName}`);
        return;
    }
    
    const data = fs.readFileSync(filePath);
    try {
        parser.parseString(data, function (err, result) {
            if (err) {
                console.error(`ERROR parsing ${fileName}: ${err.message}`);
                return;
            }
            if (!result || !result.testsuites || !result.testsuites.testsuite) {
                console.warn(`WARNING: Invalid test report structure in ${fileName}`);
                return;
            }
            
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
            fs.writeFileSync(filePath, xml);
            console.log(`Processed: ${fileName} (${finalSuite.$.tests} tests, ${finalSuite.$.failures} failures)`);
        });
    } catch (parseErr) {
        console.error(`ERROR processing ${fileName}: ${parseErr.message}`);
    }
}

const mergeResults = async (resultsPath, reportName) => {
    const outputFile = `${resultsPath}/${reportName}`;
    const inputFiles = [];
    
    fs.readdirSync(resultsPath)
        .filter(file => file.endsWith('.xml') && file !== reportName)
        .forEach(file => {
            const filePath = `${resultsPath}/${file}`;
            if (validateXmlFile(filePath)) {
                inputFiles.push(filePath);
            }
        });

    if (inputFiles.length === 0) {
        throw new Error('No valid XML files found to merge');
    }
    
    console.log(`Merging ${inputFiles.length} test reports into ${reportName}`);
    await mergeFiles(outputFile, inputFiles);
    
    // Verify output was created
    if (!fs.existsSync(outputFile)) {
        throw new Error(`Merged output file was not created: ${outputFile}`);
    }
    console.log(`Successfully created merged report: ${reportName}`);
}

(async () => {
    try {
        const resultsFolder = process.env.TEST_REPORT_ROOT_PATH;
        const testReportName = process.env.TEST_REPORT_NAME;
        
        if (!resultsFolder || !testReportName) {
            throw new Error('Missing required env vars: TEST_REPORT_ROOT_PATH and TEST_REPORT_NAME');
        }
        
        console.log(`Processing test reports in: ${resultsFolder}`);
        console.log(`Output report name: ${testReportName}`);
        
        const files = fs.readdirSync(resultsFolder)
            .filter(file => file.endsWith('.xml') && file !== testReportName);
        
        console.log(`Found ${files.length} report files to process`);
        
        files.forEach(file => {
            processResult(resultsFolder, file);
        });
        
        await mergeResults(resultsFolder, testReportName);
        console.log('Test report processing completed successfully');
    } catch (err) {
        console.error(`FATAL ERROR: ${err.message}`);
        process.exit(1);
    }
})();
