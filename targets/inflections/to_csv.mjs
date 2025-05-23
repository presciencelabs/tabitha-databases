import { stdin as input, argv } from 'node:process'
import { createInterface } from 'node:readline'

const parts_of_speech = [
	'Adjective',
	'Adverb',
	'Noun',
	'Verb',
]

const part_of_speech = argv[2]
if (! parts_of_speech.includes(part_of_speech)) {
	console.error(`${part_of_speech} is not valid`)
	console.error(`usage: node to_csv.mjs [${parts_of_speech.join('|')}] < <input file>`)

	process.exit(1)
}

const extracted_data = new Map()

const line_reader = createInterface({ input })
line_reader.on('line', extract)
line_reader.on('close', output)

// extraction based on the following format as of Jan 2024:
//		Stems
//			ALL
//				1.  stem
//
//		Inflections
//			Verbs
//				1.  abandon
//					Past: abandoned   (suppletive)
//					Perfect: abandoned
//					Participle: abandoning   (suppletive)
//					Third Singular Present: abandons
//			Nouns
//				12.  Abel-Meholah
//					Plural: Abel-Meholahs
//				13.  Abel Beth Maakah
//					Plural: Abels Beth Maakah
//			Adverbs
//				1.  abundantly
//					Comparative:
//					Superlative:
//				13.  badly
//					Comparative: badlier
//					Superlative: badliest
//				16.  carefully
//					Comparative: carefully  more
//					Superlative: carefully  most
//				43.  greatly
//					Comparative: greater   (suppletive)
//					Superlative: greatest   (suppletive)
//			Adjectives
//				109.  able
//					Comparative: able  more
//					Superlative: able  most
//				110.  about
//					Comparative:
//					Superlative:

/** @param {string} line */
function extract(line) {
	if (!line) return

	const MATCH_STEM_LINE = /^(\d+)\.\s+(.+)$/
	const [, sequence_number, stem] = line.match(MATCH_STEM_LINE) ?? []
	if (sequence_number) {
		const key = `${sequence_number}:${stem}`

		return extracted_data.set(key, [])
	}

	const inflection = line.split(':')[1].trim()
	const last_key = [...extracted_data.keys()].at(-1)
	const ADDITIONAL_INFO = / {3}\(\w+\)/ // e.g.,   (suppletive)
	const normalized_inflection = inflection.replace(ADDITIONAL_INFO, '')

	extracted_data.get(last_key).push(normalized_inflection)
}

function output() {
	for (const [key, inflections] of extracted_data) {
		const [sequence_number, stem] = key.split(':')
		console.log(`${sequence_number},${stem},${part_of_speech},|${inflections.join('|')}|`)
	}
}
