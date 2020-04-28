// Copyright 2017 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

'use strict';

const path = require('path');
const PROTO_PATH = path.join(__dirname, '/protos/genieRPC.proto');

const grpc = require('grpc');
const helloProto = grpc.load(PROTO_PATH).kt.gigagenie.ai.speech;

const speech = require('@google-cloud/speech');
const speechClient = new speech.SpeechClient(); // Creates a client

// Implement the SayHello RPC method.
const getVoice2Text = (call) => {
  //callback(null, {message: `Hello send${call.request.name}`});
  var upload_progress = 0;
  let recognizeStream = null;

  const encoding = 'LINEAR16';
  const sampleRateHertz = 16000;
  const languageCode = 'ko-KR'; //en-US
  var stt_data = null;

  const request = {
      config: {
          encoding: encoding,
          sampleRateHertz: sampleRateHertz,
          languageCode: languageCode,
          profanityFilter: false,
          enableWordTimeOffsets: true
      },
      interimResults: true, // If you want interim results, set this to true
      singleUtterance: true
  };

  call.on('data', (data)=> {
    //console.log('data');
    if (data.streamingRequest === "reqOptions") {
      //console.log(data.reqOptions.mode);
      startRecognitionStream(call);
    }
    else if (data.streamingRequest === "audioContent"){
      upload_progress += data.audioContent.length;
      //console.log(new Date(), upload_progress);
      var sendBuffer = new Buffer(data.audioContent);
      recognizeStream.write(sendBuffer);
      //call.write({resultCd:200, recognizedText:"test"})
    }
    else {
      //call.write({resultCd:400, recognizedText:"test"})
    }
    
    //var sendBuffer = new Buffer(data.audioContent);
    //console.log(sendBuffer);
  });
  call.on('end', ()=> {
    console.log('end');
    //call.write('end');
    call.end();
    //callback(null, {message: `Hello send`});
  });

  function startRecognitionStream(call) {
    recognizeStream = speechClient.streamingRecognize(request)
        .on('error', console.error)
        .on('data', (data) => {
          //console.log('stream data');
          console.log(data);
          if (data.speechEventType == "END_OF_SINGLE_UTTERANCE") {
            call.write({resultCd:201, recognizedText:stt_data})
            stopRecognitionStream();
            call.end();
          } else {
            stt_data = data.results[0].alternatives[0].transcript;
            call.write({resultCd:200, recognizedText:stt_data})
            // if end of utterance, let's restart stream
            // this is a small hack. After 65 seconds of silence, the stream will still throw an error for speech length limit
            //if (data.results[0] && data.results[0].isFinal) {
            //  call.write({resultCd:201, recognizedText:data.results[0].alternatives[0].transcript})
            //  stopRecognitionStream();
            //}
          }
        });
  }

  function stopRecognitionStream() {
    if (recognizeStream) {
        recognizeStream.end();
    }
    recognizeStream = null;
  }
};

// Start an RPC server to handle Genie service requests
const startServer = (PORT) => {
  const server = new grpc.Server();
  server.addService(helloProto.Gigagenie.service, {getVoice2Text: getVoice2Text});
  server.bind(`0.0.0.0:${PORT}`, grpc.ServerCredentials.createInsecure());
  server.start();
};

// The command-line program
const {argv} = require('yargs')
  .usage('Usage: node $0 [-p PORT]')
  .option('port', {
    alias: 'p',
    type: 'number',
    default: 50051,
    global: true,
  })
  .wrap(120)
  .epilogue(
    `For more information, see https://cloud.google.com/endpoints/docs`
  );

startServer(argv.port);
