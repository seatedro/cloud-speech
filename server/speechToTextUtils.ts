// Google Cloud
import speech, { SpeechClient } from "@google-cloud/speech";
import { google } from "@google-cloud/speech/build/protos/protos";
import Pumpify from "pumpify";
import chalk from "chalk";
import { Socket } from "socket.io";
let speechClient: SpeechClient | null = null;

class SpeechToTextUtils {
	recognizeStream!: Pumpify | null;
	resultEndTime = 0;
	isFinalEndTime = 0;
	finalRequestEndTime = 0;
	bridgingOffset = 0;
	streamingLimit = 290000;
	restartCounter = 0;
	lastTranscriptWasFinal = false;
	audioInput: DataView[] = [];
	lastAudioInput: DataView[] = [];
	newStream = true;
	socket!: Socket;
	request!: google.cloud.speech.v1.IStreamingRecognitionConfig | undefined
	restartTimeout: NodeJS.Timeout | undefined;

	set _socket(value: Socket) {
		this.socket = value;
	}

	set _request(value: google.cloud.speech.v1.IStreamingRecognitionConfig) {
		this.request = value;
	}

	startRecognitionStream(
	) {
		this.audioInput = [];
		if (!speechClient) {
			speechClient = new speech.SpeechClient(); // Creates a client
		}
		this.recognizeStream = speechClient
			.streamingRecognize(this.request)
			.on("error", (err) => {
				console.error("Error when processing audio: " + err);
				this.socket.emit("googleCloudStreamError", err);
				this.stopRecognitionStream();
			})
			.on("data", this.speechCallback.bind(this));

			this.restartTimeout = setTimeout(this.restartStream.bind(this), this.streamingLimit);
	}

	speechCallback(stream: any) {
		// Convert API result end time from seconds + nanoseconds to milliseconds
    this.resultEndTime =
      stream.results[0].resultEndTime.seconds * 1000 +
      Math.round(stream.results[0].resultEndTime.nanos / 1000000);

    // Calculate correct time based on offset from audio sent twice
    const correctedTime =
      this.resultEndTime - this.bridgingOffset + this.streamingLimit * this.restartCounter;

    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    let stdoutText = '';
    if (stream.results[0] && stream.results[0].alternatives[0]) {
      stdoutText =
        correctedTime + ': ' + stream.results[0].alternatives[0].transcript;
    }

    if (stream.results[0].isFinal) {
      process.stdout.write(chalk.green(`${stdoutText}\n`));
			this.socket.emit('speechData', stream.results[0].alternatives[0].transcript);

      this.isFinalEndTime = this.resultEndTime;
      this.lastTranscriptWasFinal = true;
    } else {
      // Make sure transcript does not exceed console character length
      if (stdoutText.length > process.stdout.columns) {
        stdoutText =
          stdoutText.substring(0, process.stdout.columns - 4) + '...';
      }
      process.stdout.write(chalk.red(`${stdoutText}`));

      this.lastTranscriptWasFinal = false;
    }
	}

	restartStream() {
    if (this.recognizeStream) {
      this.recognizeStream.end();
      this.recognizeStream.removeListener('data', this.speechCallback);
      this.recognizeStream = null;
    }
    if (this.resultEndTime > 0) {
      this.finalRequestEndTime = this.isFinalEndTime;
    }
    this.resultEndTime = 0;

    this.lastAudioInput = [];
    this.lastAudioInput = this.audioInput;

    this.restartCounter++;

    if (!this.lastTranscriptWasFinal) {
      process.stdout.write('\n');
    }
    process.stdout.write(
      chalk.yellow(`${this.streamingLimit * this.restartCounter}: RESTARTING REQUEST\n`)
    );

    this.newStream = true;

    this.startRecognitionStream();
  }

	/**
	 * Closes the recognize stream and wipes it
	 */
	stopRecognitionStream() {
		if (this.recognizeStream) {
			this.recognizeStream.end();
		}
		if (this.restartTimeout) {
			clearTimeout(this.restartTimeout);
		}
		this.recognizeStream = null;
	}
	/**
	 * Receives streaming data and writes it to the recognizeStream for transcription
	 *
	 * @param {Buffer} data A section of audio data
	 */
	receiveData(data: DataView) {
		if (this.newStream && this.lastAudioInput.length !== 0 && this.recognizeStream) {
			// Approximate math to calculate time of chunks
			const chunkTime = this.streamingLimit / this.lastAudioInput.length;
			if (chunkTime !== 0) {
				if (this.bridgingOffset < 0) {
					this.bridgingOffset = 0;
				}
				if (this.bridgingOffset > this.finalRequestEndTime) {
					this.bridgingOffset = this.finalRequestEndTime;
				}
				const chunksFromMS = Math.floor(
					(this.finalRequestEndTime - this.bridgingOffset) / chunkTime
				);
				this.bridgingOffset = Math.floor(
					(this.lastAudioInput.length - chunksFromMS) * chunkTime
				);

				for (let i = chunksFromMS; i < this.lastAudioInput.length; i++) {
					this.recognizeStream.write(this.lastAudioInput[i]);
				}
			}
			this.newStream = false;
		}

		this.audioInput.push(data);

		if (this.recognizeStream) {
			this.recognizeStream.write(data);
		}
	}
}

export default new SpeechToTextUtils();
