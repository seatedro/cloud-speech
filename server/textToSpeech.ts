// Imports the Google Cloud client library
import textToSpeech from '@google-cloud/text-to-speech';
import { google } from '@google-cloud/text-to-speech/build/protos/protos';
import { Socket } from 'socket.io';

// Creates a client
export class TextToSpeechUtils {
	socket: Socket;
	
	constructor(socket: Socket) {
		this.socket = socket;
	}
	async tts(text: string) {
		const client = new textToSpeech.TextToSpeechClient();
		// The text to synthesize
	
		// Construct the request
		const request: google.cloud.texttospeech.v1.ISynthesizeSpeechRequest = {
			input: {text: text},
			// Select the language and SSML voice gender (optional)
			voice: {languageCode: 'en-US', ssmlGender: 'NEUTRAL'},
			// select the type of audio encoding
			audioConfig: {audioEncoding: 'OGG_OPUS'},
		};
	
		// Performs the text-to-speech request
		const [response] = await client.synthesizeSpeech(request);
		// Send the response to the client through socket as a buffer 
		this.socket.emit('ttsResponse', response.audioContent);
		console.log('Audio content written to file: output.mp3');
	}
}