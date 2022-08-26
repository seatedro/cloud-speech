import { FormControl } from "@angular/forms"

export type StartGoogleCloudStream = {
	config: {
		encoding: string,
		sampleRateHertz: number,
		languageCode: string,
		profanityFilter: boolean,
		enableWordTimeOffsets: boolean,
	},
	interimResults: boolean,
}

export type FormType = {
  text: FormControl<string | null>,
}
