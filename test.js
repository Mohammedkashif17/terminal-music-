const { spawn } = require("node:child_process");
const childProcess = spawn('ls');
childProcess.stdout.on('data', (data) => {
    console.log(data.toString());
});