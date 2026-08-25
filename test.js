const { spawn } = reqiure("node:child_process");
const childProcess = spwn('ls');
childProcess.stdout.on('data', (data)=> {
    console.log(data.toString())
})