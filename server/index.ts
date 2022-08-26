import express, { Express, Request, Response } from 'express';
import { Server, Socket } from 'socket.io';
import {createServer} from 'https';
import speechToTextUtils from './speechToTextUtils';
import { TextToSpeechUtils } from './textToSpeech';
import fs from 'fs';
const app: Express = express();
const server = createServer({
	key: fs.readFileSync('key.pem'),
	cert: fs.readFileSync('cert.pem')
}, app);
const port = 3000;
const io = new Server(server, {
	cors: {
		origin: '*',
	}
});
import { google } from '@google-cloud/speech/build/protos/protos';
import { config } from 'dotenv'
const environmentVars = config();

io.on('connection', (socket: Socket) => {
	console.log("Socket Connection: ", socket.connected);
	console.log("Socket Id: ", socket.id);
	speechToTextUtils._socket = socket;
	socket.on('startGoogleCloudStream', (request: google.cloud.speech.v1.IStreamingRecognitionConfig ) => {
		speechToTextUtils._request = request;
		console.log('Starting Google Cloud Transcription');
		speechToTextUtils.startRecognitionStream();
	});
// Receive audio data
	socket.on('binaryAudioData', function(data: DataView) {
			speechToTextUtils.receiveData(data);
	});

// End the audio stream
	socket.on('endGoogleCloudStream', function() {
			speechToTextUtils.stopRecognitionStream();
	});

	// Receive tts question
	socket.on('speechQuestion', function(data: string) {
			const textToSpeechUtils = new TextToSpeechUtils(socket);
			textToSpeechUtils.tts(data);
	})
})



app.get('/', (req: Request, res: Response) => {
  res.send('Express + TypeScript Server');
});

server.listen(port, () => {
  console.log(`⚡️[server]: Server is running at https://localhost:${port}`);
});