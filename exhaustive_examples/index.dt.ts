type SourceEntity = {
	type: string
	label: string
	features: string
	value: string
	sense: string
}

type Concept = {
	stem: string
	sense: string
	part_of_speech: string
}

type Reference = {
	type: string
	id_primary: string
	id_secondary: string
	id_tertiary: string
}

type ContextArguments = Record<string, string>

type Feature = {
	index: number
	labels: Record<string, string>
	letters: Record<string, string>
}