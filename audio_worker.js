ObjC.import("AVFoundation");
ObjC.import("Foundation");

function run(argv) {
    if (!argv || argv.length === 0) return;
    var filePath = argv[0];
    var initialVol = argv[1] ? parseFloat(argv[1]) : 1.0;

    var url = $.NSURL.fileURLWithPath(filePath);
    var error = Ref();
    var player = $.AVAudioPlayer.alloc.initWithContentsOfURLError(url, error);
    if (!player) {
        $.exit(1);
    }
    player.volume = initialVol;
    player.prepareToPlay;
    player.play;

    var stdin = $.NSFileHandle.fileHandleWithStandardInput;

    while (true) {
        var data = stdin.availableData;
        if (data.length === 0) {
            // Pipe closed
            break;
        }
        var str = ObjC.unwrap($.NSString.alloc.initWithDataEncoding(data, $.NSUTF8StringEncoding));
        if (!str) continue;
        var lines = str.trim().split("\n");
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line) continue;
            var parts = line.split(" ");
            var cmd = parts[0];

            if (cmd === "forward") {
                var delta = parts[1] ? parseFloat(parts[1]) : 5.0;
                player.currentTime = Math.min(player.duration, player.currentTime + delta);
                console.log("TIME:" + player.currentTime.toFixed(1) + "/" + player.duration.toFixed(1));
            } else if (cmd === "backward") {
                var delta = parts[1] ? parseFloat(parts[1]) : 5.0;
                player.currentTime = Math.max(0, player.currentTime - delta);
                console.log("TIME:" + player.currentTime.toFixed(1) + "/" + player.duration.toFixed(1));
            } else if (cmd === "pause") {
                player.pause;
            } else if (cmd === "resume") {
                player.play;
            } else if (cmd === "volume") {
                if (parts[1]) {
                    player.volume = parseFloat(parts[1]);
                }
            } else if (cmd === "tick") {
                if (!player.isPlaying && player.currentTime >= player.duration - 0.3) {
                    console.log("ENDED");
                    return;
                }
                console.log("TIME:" + player.currentTime.toFixed(1) + "/" + player.duration.toFixed(1));
            } else if (cmd === "stop") {
                player.stop;
                return;
            }
        }
    }
}
