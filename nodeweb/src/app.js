'use strict'

//  Google Cloud Speech Playground with node.js and socket.io
//  Created by Vinzenz Aubry for sansho 24.01.17
//  Feel free to improve!
//	Contact: vinzenz@sansho.studio

const express = require('express'); // const bodyParser = require('body-parser'); // const path = require('path');
const fs = require('fs');
const path = require('path');
const environmentVars = require('dotenv').config();
const grpc = require('grpc');

  // Load protobuf spec for an example API
const PROTO_PATH = path.join(__dirname, '/protos/genieRPC.proto');
const protoObj = grpc.load(PROTO_PATH).kt.gigagenie.ai.speech;

const app = express();
const port = process.env.PORT || 1337;
const server = require('http').createServer(app);

const io = require('socket.io')(server);

app.use('/assets', express.static(__dirname + '/public'));
app.use('/session/assets', express.static(__dirname + '/public'));

app.set('view engine', 'ejs');

const viewsPath = path.join(__dirname, '/views') 
app.set('views', viewsPath)

// =========================== ROUTERS ================================ //

app.get('/', function (req, res) {
    res.render('index', {});
});

app.use('/', function (req, res, next) {
    next(); // console.log(`Request Url: ${req.url}`);
});


// =========================== SOCKET.IO ================================ //

io.on('connection', function (client) {
    console.log('Client Connected to server');
    let recognizeStream = null;
    var stt = null;
    var mode = 0;
    var stt_data = null;
    client.on('join', function (data) {
        client.emit('messages', 'Socket Connected to Server');
    });

    client.on('messages', function (data) {
        client.emit('broad', data);
    });

    client.on('startGrpcStream', function (data) {
        startRecognitionStream(this, data);
    });

    client.on('endGrpcStream', function (data) {
        stopRecognitionStream();
    });

    client.on('binaryData', function (data) {
        //console.log(data); //log binary data
        if (stt !== null) {
            stt.write({audioContent:data});
        }
    });

    function startRecognitionStream(client, data) {
        var genieProto = new protoObj.Gigagenie('localhost:50051',grpc.credentials.createInsecure());
        // Build gRPC request
        const metadata = new grpc.Metadata();

        stt=genieProto.getVoice2Text();

        stt.on('error',(error)=>{
            console.log('Error:'+error);
        });
        stt.on('data',(data)=>{
            console.log('stt result:'+JSON.stringify(data));
            stt_data = data;
            client.emit('speechData', stt_data);
            if(data.resultCd!==200) mode=2;
            if(data.resultCd == 509 ){
                console.log('resOptions resultCd == 509 License limit exceeded');
                return;
            }
        });
        stt.on('end',()=>{
            console.log('stt text stream end');
            if(stt_data == null)
            {
                stt_data = "";
            }
            if(stt_data.resultCd == 509 ){
              mode=0;
              return;
            }
            mode=0;
        });
        stt.write({reqOptions:{mode:0,lang:0}});
        mode=2;
    }

    function stopRecognitionStream() {
        if (recognizeStream) {
            recognizeStream.end();
        }
        recognizeStream = null;
    }
});
// =========================== START SERVER ================================ //

server.listen(port, "127.0.0.1", function () { //http listen, to make socket work
    // app.address = "127.0.0.1";
    console.log('Server started on port:' + port)
});