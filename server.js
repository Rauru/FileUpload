var app = require('http').createServer(handler)
    , io = require('socket.io').listen(app)
    , fs = require('fs')
    , exec = require('child_process').exec
    , util = require('util')
    , Files = {};

app.listen(3000);

function handler(req, res) {
    fs.readFile(__dirname + '/index.html',
        function (err, data) {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'text/html' });
                return res.end('Error loading index.html');
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        });
}

io.sockets.on('connection', function (socket) {
    socket.on('Start', function (data) { //data contains the variables that we passed through in the html file
        var Name = data['Name'];
        Files[Name] = {  //Create a new Entry in The Files Variable
            FileSize: data['Size'],
            Data: "",
            Downloaded: 0
        }
        var Place = 0;
        try {
            var Stat = fs.statSync('Temp/' + Name);
            if (Stat.isFile()) {
                Files[Name]['Downloaded'] = Stat.size;
                Place = Stat.size / 524288;
            }
        }
        catch (er) { } //It's a New File
        fs.open("Temp/" + Name, 'a', 0755, function (err, fd) {
            if (err) {
                console.log(err);
            }
            else {
                Files[Name]['Handler'] = fd; //We store the file handler so we can write to it later
                socket.emit('MoreData', { 'Place': Place, Percent: 0 });
            }
        });
    });

    socket.on('Upload', function (data) {
        var Name = data['Name'];
        Files[Name]['Downloaded'] += data['Data'].length;
        Files[Name]['Data'] += data['Data'];
        if (Files[Name]['Downloaded'] == Files[Name]['FileSize']) //If File is Fully Uploaded
        {
            /*fs.write(Files[Name]['Handler'], Files[Name]['Data'], null, 'Binary', function (err, Writen) {
                var inp = fs.createReadStream("Temp/" + Name);
                var out = fs.createWriteStream("Video/" + Name);
                inp.pump(inp, out, function () {
                    fs.unlink("Temp/" + Name, function () { //This Deletes The Temporary File
                        exec("ffmpeg -i Video/" + Name + " -ss 01:30 -r 1 -an -vframes 1 -f mjpeg Video/" + Name + ".jpg", function (err) {
                            socket.emit('Done', { 'Image': 'Video/' + Name + '.jpg' });
                        });
                    });
                });
            });*/
            fs.write(Files[Name]['Handler'], Files[Name]['Data'], null, 'Binary', function (err, Writen) {
                var input = fs.createReadStream("Temp/" + Name);
                var output = fs.createWriteStream("Video/" + Name);

                //util.pump(readableStream, writableStream, [callback])
                //Deprecated: Use readableStream.pipe(writableStream)
                input.pipe(output);
                input.on("end", function () {
                    console.log("end");
                    fs.unlink("Temp/" + Name, function () { //This Deletes The Temporary File
                        exec("ffmpeg -i Video/" + Name + " -ss 00:00 -r 1 -an -vframes 1 -f mjpeg Video/" + Name + ".jpg", function (err) {
                            socket.emit('Done', { 'Image': 'Video/' + Name + '.jpg' });
                        });
                        console.log("unlink this file:", Name);
                    });
                });
            });
        }
        else if (Files[Name]['Data'].length > 10485760) { //If the Data Buffer reaches 10MB
            fs.write(Files[Name]['Handler'], Files[Name]['Data'], null, 'Binary', function (err, Writen) {
                Files[Name]['Data'] = ""; //Reset The Buffer
                var Place = Files[Name]['Downloaded'] / 524288;
                var Percent = (Files[Name]['Downloaded'] / Files[Name]['FileSize']) * 100;
                socket.emit('MoreData', { 'Place': Place, 'Percent': Percent });
            });
        }
        else {
            var Place = Files[Name]['Downloaded'] / 524288;
            var Percent = (Files[Name]['Downloaded'] / Files[Name]['FileSize']) * 100;
            socket.emit('MoreData', { 'Place': Place, 'Percent': Percent });
        }
    });
});
