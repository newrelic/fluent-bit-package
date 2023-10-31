const { spawnSync } = require('child_process');
const logger = require('./logger');

const testOnlyIfSet = (environmentVariableName) => {
    return process.env[environmentVariableName] ? test : test.skip;
}

const waitForLogMessageContaining = async (nrdb, substring) => {
    return nrdb.waitToFindOne({ where: `message like '%${substring}%'` });
}

const executeSync = (command, commandArguments, expectedExitCode) => {
    const result = spawnSync(command, commandArguments);

    logger.info(result.stdout?.toString());
    logger.error(result.stderr?.toString());
    expect(result.status).toEqual(expectedExitCode);
}

module.exports = {
    testOnlyIfSet,
    waitForLogMessageContaining,
    executeSync
}