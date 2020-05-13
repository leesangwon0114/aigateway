'use strict'

//  Google Cloud Speech Playground with node.js and socket.io
//  Created by Vinzenz Aubry for sansho 24.01.17
//  Feel free to improve!
//	Contact: vinzenz@sansho.studio

//connection to socket
const socket = io.connect();

//================= CONFIG =================
// Stream Audio
let bufferSize = 2048,
	AudioContext,
	context,
	processor,
	input,
	globalStream;

//vars
let audioElement = document.querySelector('audio'),
	finalWord = false,
	resultText = document.getElementById('ResultText'),
	removeLastSentence = true,
	streamStreaming = false;


//audioStream constraints
const constraints = {
	audio: true,
	video: false
};

//================= RECORDING =================
function initRecording() {
	socket.emit('startGrpcStream', '');
	streamStreaming = true;
	AudioContext = window.AudioContext || window.webkitAudioContext;
	context = new AudioContext({
		// if Non-interactive, use 'playback' or 'balanced' // https://developer.mozilla.org/en-US/docs/Web/API/AudioContextLatencyCategory
		latencyHint: 'interactive',
	});
	processor = context.createScriptProcessor(bufferSize, 1, 1);
	processor.connect(context.destination);
	context.resume();

	var handleSuccess = function (stream) {
		globalStream = stream;
		input = context.createMediaStreamSource(stream);
		input.connect(processor);

		processor.onaudioprocess = function (e) {
			microphoneProcess(e);
		};
	};

	navigator.mediaDevices.getUserMedia(constraints)
		.then(handleSuccess);
}

function microphoneProcess(e) {
	var left = e.inputBuffer.getChannelData(0);
	// var left16 = convertFloat32ToInt16(left); // old 32 to 16 function
	var left16 = downsampleBuffer(left, 44100, 16000)
	socket.emit('binaryData', left16);
}




//================= INTERFACE =================
var startButton = document.getElementById("startRecButton");
startButton.addEventListener("click", startRecording);

var endButton = document.getElementById("stopRecButton");
endButton.addEventListener("click", stopRecording);
endButton.disabled = true;

var recordingStatus = document.getElementById("recordingStatus");


function startRecording() {
	startButton.disabled = true;
	endButton.disabled = false;
	recordingStatus.style.visibility = "visible";
	initRecording();
}

function stopRecording() {
	// waited for FinalWord
	startButton.disabled = false;
	endButton.disabled = true;
	recordingStatus.style.visibility = "hidden";
	streamStreaming = false;
	socket.emit('endGrpcStream', '');


	let track = globalStream.getTracks()[0];
	track.stop();

	input.disconnect(processor);
	processor.disconnect(context.destination);
	context.close().then(function () {
		input = null;
		processor = null;
		context = null;
		AudioContext = null;
		startButton.disabled = false;
	});

	// context.close();


	// audiovideostream.stop();

	// microphone_stream.disconnect(script_processor_node);
	// script_processor_node.disconnect(audioContext.destination);
	// microphone_stream = null;
	// script_processor_node = null;

	// audiovideostream.stop();
	// videoElement.srcObject = null;
}

//================= SOCKET IO =================
socket.on('connect', function (data) {
	socket.emit('join', 'Server Connected to Client');
});


socket.on('messages', function (data) {
	console.log(data);
});


socket.on('speechData', function (data) {
	console.log(data);
	resultText.lastElementChild.remove();
	if (data.resultCd == 200) {
		//add empty span
		let empty = document.createElement('span');
		empty.innerHTML=data.recognizedText;
		resultText.appendChild(empty);

	} else if (data.resultCd == 201) {
		let empty = document.createElement('span');
		empty.innerHTML=data.recognizedText;
		resultText.appendChild(empty);

		console.log("Google Speech sent 'final' Sentence.");
		finalWord = true;
		endButton.disabled = false;

		removeLastSentence = false;
		stopRecording();
	}
});


//================= Juggling Spans for nlp Coloring =================
function addTimeSettingsInterim(speechData) {
	let wholeString = speechData.results[0].alternatives[0].transcript;
	console.log(wholeString);

	let nlpObject = nlp(wholeString).out('terms');

	let words_without_time = [];

	for (let i = 0; i < nlpObject.length; i++) {
		//data
		let word = nlpObject[i].text;
		let tags = [];

		//generate span
		let newSpan = document.createElement('span');
		newSpan.innerHTML = word;

		//push all tags
		for (let j = 0; j < nlpObject[i].tags.length; j++) {
			tags.push(nlpObject[i].tags[j]);
		}

		//add all classes
		for (let j = 0; j < nlpObject[i].tags.length; j++) {
			let cleanClassName = tags[j];
			// console.log(tags);
			let className = `nl-${cleanClassName}`;
			newSpan.classList.add(className);
		}

		words_without_time.push(newSpan);
	}

	finalWord = false;
	endButton.disabled = true;

	return words_without_time;
}

function addTimeSettingsFinal(speechData) {
	let wholeString = speechData.results[0].alternatives[0].transcript;

	let nlpObject = nlp(wholeString).out('terms');
	let words = speechData.results[0].alternatives[0].words;

	let words_n_time = [];

	for (let i = 0; i < words.length; i++) {
		//data
		let word = words[i].word;
		let startTime = `${words[i].startTime.seconds}.${words[i].startTime.nanos}`;
		let endTime = `${words[i].endTime.seconds}.${words[i].endTime.nanos}`;
		let tags = [];

		//generate span
		let newSpan = document.createElement('span');
		newSpan.innerHTML = word;
		newSpan.dataset.startTime = startTime;

		//push all tags
		for (let j = 0; j < nlpObject[i].tags.length; j++) {
			tags.push(nlpObject[i].tags[j]);
		}

		//add all classes
		for (let j = 0; j < nlpObject[i].tags.length; j++) {
			let cleanClassName = nlpObject[i].tags[j];
			// console.log(tags);
			let className = `nl-${cleanClassName}`;
			newSpan.classList.add(className);
		}

		words_n_time.push(newSpan);
	}

	return words_n_time;
}

window.onbeforeunload = function () {
	if (streamStreaming) { socket.emit('endGoogleCloudStream', ''); }
};

//================= SANTAS HELPERS =================

// sampleRateHertz 16000 //saved sound is awefull
function convertFloat32ToInt16(buffer) {
	let l = buffer.length;
	let buf = new Int16Array(l / 3);

	while (l--) {
		if (l % 3 == 0) {
			buf[l / 3] = buffer[l] * 0xFFFF;
		}
	}
	return buf.buffer
}

var downsampleBuffer = function (buffer, sampleRate, outSampleRate) {
	if (outSampleRate == sampleRate) {
		return buffer;
	}
	if (outSampleRate > sampleRate) {
		throw "downsampling rate show be smaller than original sample rate";
	}
	var sampleRateRatio = sampleRate / outSampleRate;
	var newLength = Math.round(buffer.length / sampleRateRatio);
	var result = new Int16Array(newLength);
	var offsetResult = 0;
	var offsetBuffer = 0;
	while (offsetResult < result.length) {
		var nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
		var accum = 0, count = 0;
		for (var i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
			accum += buffer[i];
			count++;
		}

		result[offsetResult] = Math.min(1, accum / count) * 0x7FFF;
		offsetResult++;
		offsetBuffer = nextOffsetBuffer;
	}
	return result.buffer;
}

function capitalize(s) {
	if (s.length < 1) {
		return s;
	}
	return s.charAt(0).toUpperCase() + s.slice(1);
}

// Supervised Learning Test code
async function imageClassificationWithImage() {
    console.log('Loading mobilenet..');
  
    // Load the model.
    net = await mobilenet.load();
    console.log('Successfully loaded model');
  
    // Make a prediction through the model on our image.
    const imgEl = document.getElementById('img');
    const result = await net.classify(imgEl);
    console.log(result);
  }
  
  async function imageClassificationWithWebcam() {
    console.log('Loading mobilenet..');
  
    // Load the model.
    net = await mobilenet.load();
    console.log('Successfully loaded model');
  
    // Create an object from Tensorflow.js data API which could capture image
    // from the web camera as Tensor.
    const webcam = await tf.data.webcam(webcamElement);
    while (true) {
      const img = await webcam.capture();
      const result = await net.classify(img);
  
      document.getElementById('console').innerText = `
        prediction: ${result[0].className}\n
        probability: ${result[0].probability}
      `;
      // Dispose the tensor to release the memory.
      img.dispose();
  
      // Give some breathing room by waiting for the next animation frame to
      // fire.
      await tf.nextFrame();
    }
  }
  
  const start = async () => {
    const createKNNClassifier = async () => {
      console.log('Loading KNN Classifier');
      return await knnClassifier.create();
    };
    const createMobileNetModel = async () => {
      console.log('Loading Mobilenet Model');
      return await mobilenet.load();
    };
    const createWebcamInput = async () => {
      console.log('Loading Webcam Input');
      const webcamElement = await document.getElementById('webcam');
      return await tf.data.webcam(webcamElement);
    };
  
    //const mobilenetModel = await createMobileNetModel();
    const knnClassifierModel = await createKNNClassifier();
    const webcamInput = await createWebcamInput();
  
    const initializeElements = () => {
      document.getElementById('load_button').addEventListener('change', (event) => uploadModel(knnClassifierModel,event));
      document.getElementById('save_button').addEventListener('click', async () => downloadModel(knnClassifierModel));
      document.getElementById('infer').addEventListener('click', async() => imageClassificationWithTransferLearningOnWebcam());
      document.getElementById('class-a').addEventListener('click', () => addDatasetClass(0));
      document.getElementById('class-b').addEventListener('click', () => addDatasetClass(1));
      document.getElementById('class-c').addEventListener('click', () => addDatasetClass(2));
    };
  
    const saveClassifier = async (classifierModel) => {
      let datasets = await classifierModel.getClassifierDataset();
      let datasetObject = {};
      Object.keys(datasets).forEach(async (key) => {
        let data = await datasets[key].dataSync();
        datasetObject[key] = Array.from(data);
      });
      let jsonModel = JSON.stringify(datasetObject);
  
      let downloader = document.createElement('a');
      downloader.download = "model.json";
      downloader.href = 'data:text/text;charset=utf-8,' + encodeURIComponent(jsonModel);
      document.body.appendChild(downloader);
      downloader.click();
      downloader.remove();
    };
  
    const uploadModel = async (classifierModel, event) => {
      let inputModel = event.target.files;
      console.log("Uploading");
      let fr = new FileReader();
      if (inputModel.length>0) {
        fr.onload = async () => {
          var dataset = fr.result;
          var tensorObj = JSON.parse(dataset);
  
          Object.keys(tensorObj).forEach((key) => {
            tensorObj[key] = tf.tensor(tensorObj[key], [tensorObj[key].length / 1024, 1024]);
          });
          classifierModel.setClassifierDataset(tensorObj);
          console.log("Classifier has been set up! Congrats! ");
        };
      }
      await fr.readAsText(inputModel[0]);
      console.log("Uploaded");
    };
  
    const downloadModel = async (classifierModel) => {
      saveClassifier(classifierModel);
    };
    const putImageToPage = (event) => {
      var input = event.target;
  
      var reader = new FileReader();
      reader.onload = function () {
        var dataURL = reader.result;
        var output = document.getElementById('output');
        output.src = dataURL;
      };
      reader.readAsDataURL(input.files[0]);
	};
	
	function json2array(json){
		var result = [];
		var keys = Object.keys(json);
		keys.forEach(function(key){
			result.push(json[key]);
		});
		return result;
	}
  
    const addDatasetClass = async (classId) => {
      // Capture an image from the web camera.
	  const img = await webcamInput.capture();
	  //var video = document.getElementById("webcam");
	  //var canvas = document.getElementById("capture");
	  //var ctx = canvas.getContext("2d");
      //ctx.drawImage(video, 0,0,224, 224);
      // Get the intermediate activation of MobileNet 'conv_preds' and pass that
	  // to the KNN classifier.
	  
	  $.post( "http://localhost:1337/upload", { img: JSON.stringify(img.dataSync()) })//canvas.toDataURL('image/jpeg')})
		.done(function( data ) {
			//console.log('adddatasample')
			var activation = tf.tensor(json2array(data["success"]));
			knnClassifierModel.addExample(activation, classId);
			//console.log(classId);
			activation.dispose();
		});
      //const activation = mobilenetModel.infer(img, 'conv_preds');
  
      // Pass the intermediate activation to the classifier.
      //knnClassifierModel.addExample(activation, classId);
  
      // Dispose the tensor to release the memory.
      //img.dispose();
    };
    const imageClassificationWithTransferLearningOnWebcam = async () => {
      console.log("Machine Learning on the web is ready");
      //while (true) {
        if (knnClassifierModel.getNumClasses() > 0) {
          const img = await webcamInput.capture();
		  //var video = document.getElementById("webcam");
		  //var canvas = document.getElementById("capture");
		  //var ctx = canvas.getContext("2d");
		  //ctx.drawImage(video, 0,0,224, 224);
		  // Get the intermediate activation of MobileNet 'conv_preds' and pass that
		  // to the KNN classifier.
		  
		  $.post( "http://localhost:1337/upload", { img: JSON.stringify(img.dataSync()) })
			.done(function( data ) {
				var activation = tf.tensor(json2array(data["success"]));
				knnClassifierModel.predictClass(activation)
				.then(result => {
					const classes = [document.getElementById("c1").value, document.getElementById("c2").value, document.getElementById("c3").value];
					document.getElementById('console').innerText = `
					prediction: ${classes[result.label]}\n
					probability: ${result.confidences[result.label]}
					`;
				});
				activation.dispose();
			});
			await tf.nextFrame();
        }
        //await tf.nextFrame();
      //}
    };
  
    await initializeElements();
    //await imageClassificationWithTransferLearningOnWebcam();
  };

//================================unsupervised code
var canvas; 
var ctx;
var height = 400;
var width = 400;
var data = [
    [140, 40],
    [145, 50],
    [146, 45], 
    [147, 40],
	[150, 50],
	
    [170, 60],
    [171, 66],
    [173, 66],
    [178, 70],
];
/*
var data = [
    [1, 2],
    [2, 1],
    [2, 4], 
    [1, 3],
    [2, 2],
    [3, 1],
    [1, 1],

    [7, 3],
    [8, 2],
    [6, 4],
    [7, 4],
    [8, 1],
    [9, 2],

    [10, 8],
    [9, 10],
    [7, 8],
    [7, 9],
    [8, 11],
    [9, 9],
];
*/
var means = [];
var assignments = [];
var dataExtremes = null;
var dataRange = null;
var drawDelay = 2000;

function setup(num) {
	canvas = document.getElementById('canvas');
	ctx = canvas.getContext('2d');

	dataExtremes = getDataExtremes(data);
	dataRange = getDataRanges(dataExtremes);
	means = initMeans(num);

	makeAssignments();
	draw();

	setTimeout(run, drawDelay);
}

function getDataRanges(extremes) {
	var ranges = [];
	for (var dimension in extremes)
	{
		ranges[dimension] = extremes[dimension].max - extremes[dimension].min;
	}
	return ranges;
}

function getDataExtremes(points) {
	var extremes = [];
	for (var i in data)
	{
		var point = data[i];
		for (var dimension in point)
		{
			if ( ! extremes[dimension] )
			{
				extremes[dimension] = {min: 1000, max: 0};
			}
			if (point[dimension] < extremes[dimension].min)
			{
				extremes[dimension].min = point[dimension];
			}
			if (point[dimension] > extremes[dimension].max)
			{
				extremes[dimension].max = point[dimension];
			}
		}
	}
	return extremes;
}

function initMeans(k) {
	if ( ! k )
	{
		k = 3;
	}
	while (k--)
	{
		var mean = [];
		for (var dimension in dataExtremes)
		{
			mean[dimension] = dataExtremes[dimension].min + ( Math.random() * dataRange[dimension] );
		}
		means.push(mean);
	}
	return means;
};

function makeAssignments() {
	for (var i in data)
	{
		var point = data[i];
		var distances = [];

		for (var j in means)
		{
			var mean = means[j];
			var sum = 0;

			for (var dimension in point)
			{
				var difference = point[dimension] - mean[dimension];
				difference *= difference;
				sum += difference;
			}
			distances[j] = Math.sqrt(sum);
		}
		assignments[i] = distances.indexOf( Math.min.apply(null, distances) );
	}
}

function moveMeans() {
	makeAssignments();
	var sums = Array( means.length );
	var counts = Array( means.length );
	var moved = false;
	for (var j in means)
	{
		counts[j] = 0;
		sums[j] = Array( means[j].length );
		for (var dimension in means[j])
		{
			sums[j][dimension] = 0;
		}
	}

	for (var point_index in assignments)
	{
		var mean_index = assignments[point_index];
		var point = data[point_index];
		var mean = means[mean_index];

		counts[mean_index]++;

		for (var dimension in mean)
		{
			sums[mean_index][dimension] += point[dimension];
		}
	}

	for (var mean_index in sums)
	{
		console.log(counts[mean_index]);
		if ( 0 === counts[mean_index] ) 
		{
			sums[mean_index] = means[mean_index];
			console.log("Mean with no points");
			console.log(sums[mean_index]);

			for (var dimension in dataExtremes)
			{
				sums[mean_index][dimension] = dataExtremes[dimension].min + ( Math.random() * dataRange[dimension] );
			}
			continue;
		}

		for (var dimension in sums[mean_index])
		{
			sums[mean_index][dimension] /= counts[mean_index];
		}
	}

	if (means.toString() !== sums.toString())
	{
		moved = true;
	}

	means = sums;
	return moved;
}

function run() {
	var moved = moveMeans();
	draw();

	if (moved)
	{
		setTimeout(run, drawDelay);
	}

}
function draw() {
	ctx.clearRect(0,0,width, height);
	ctx.globalAlpha = 0.3;
	for (var point_index in assignments)
	{
		var mean_index = assignments[point_index];
		var point = data[point_index];
		var mean = means[mean_index];

		ctx.save();

		ctx.strokeStyle = 'blue';
		ctx.beginPath();
		ctx.moveTo(
			(point[0] - dataExtremes[0].min + 1) * (width / (dataRange[0] + 2) ),
			(point[1] - dataExtremes[1].min + 1) * (height / (dataRange[1] + 2) )
		);
		ctx.lineTo(
			(mean[0] - dataExtremes[0].min + 1) * (width / (dataRange[0] + 2) ),
			(mean[1] - dataExtremes[1].min + 1) * (height / (dataRange[1] + 2) )
		);
		ctx.stroke();
		ctx.closePath();
	
		ctx.restore();
	}
	ctx.globalAlpha = 1;

	for (var i in data)
	{
		ctx.save();

		var point = data[i];

		var x = (point[0] - dataExtremes[0].min + 1) * (width / (dataRange[0] + 2) );
		var y = (point[1] - dataExtremes[1].min + 1) * (height / (dataRange[1] + 2) );

		ctx.strokeStyle = '#333333';
		ctx.translate(x, y);
		ctx.beginPath();
		ctx.arc(0, 0, 5, 0, Math.PI*2, true);
		ctx.stroke();
		ctx.closePath();

		ctx.restore();
	}

	for (var i in means)
	{
		ctx.save();

		var point = means[i];

		var x = (point[0] - dataExtremes[0].min + 1) * (width / (dataRange[0] + 2) );
		var y = (point[1] - dataExtremes[1].min + 1) * (height / (dataRange[1] + 2) );

		ctx.fillStyle = 'green';
		ctx.translate(x, y);
		ctx.beginPath();
		ctx.arc(0, 0, 5, 0, Math.PI*2, true);
		ctx.fill();
		ctx.closePath();

		ctx.restore();
	}
}

function unsupervised() {
	means = [];
    assignments = [];
	dataExtremes = null;
	dataRange = null;
	setup(document.getElementById("num").value);
}
//=======================================================

window.onload = () => {
	start();
	document.getElementById('unsupervise').addEventListener('click', () => unsupervised());
};
  