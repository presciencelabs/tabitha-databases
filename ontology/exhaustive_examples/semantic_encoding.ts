
export const FEATURES = {
	NP: {
		SEMANTIC_ROLE: {
			index: 1,
			values: {
				'A': 'Agent',
				'P': 'Patient',
				'S': 'State',
				's': 'Source',
				'd': 'Destination',
				'B': 'Beneficiary',
				'I': 'Instrument',
				'D': 'Addressee',
				'N': 'Oblique',
			},
		},
	},
	VERB: {
		POLARITY: {
			index: 6,
			values: {
				'A': 'Affirmative',
				'N': 'Negative',
				'E': 'Emphatic Affirmative',
				'e': 'Emphatic Negative',
			},
		},
	},
	ADJ: {
		DEGREE: {
			index: 2,
			values: {
				'N': 'No Degree',
				'C': 'Comparative',
				'S': 'Superlative',
				'I': 'Intensified',
				'E': 'Extremely Intensified',
				'T': "'too'",
				'L': "'less'",
				'l': "'least'",
				'q': 'Equality',
				'i': 'Intensified Comparative',
				'c': "Intensified 'less'",
				's': 'Superlative of 2 items',
			},
		},
	},
	ADJP: {
		USAGE: {
			index: 1,
			values: {
				'A': 'Attributive',
				'P': 'Predicative',
			},
		},
	},
	ADV: {
		DEGREE: {
			index: 2,
			values: {
				'N': 'No Degree',
				'C': 'Comparative',
				'S': 'Superlative',
				'V': 'Intensified',
				'E': 'Extremely Intensified',
				'T': "'too'",
				'L': "'less'",
				'l': "'least'",
			},
		},
	},
	CLAUSE: {
		TYPE: {
			index: 0,
			values: {
				'I': 'Independent',
				'C': 'Coordinate Independent',
				'T': 'Restrictive Relative Clause',
				't': 'Descriptive Relative Clause',
				'E': 'Adverbial Clause',
				'A': 'Propositional Agent',
				'P': 'Propositional Patient',
				'p': 'Attributive Patient',
				'Q': 'Closing Quotation Frame',
			},
		},
		TOPIC_NP: {
			index: 2,
			values: {
				'p': 'Most Agent-Like',
				'P': 'Most Patient-Like',
			},
		},
	},
}

const ENTITY_LABEL_LOOKUP = new Map([
	['c', 'Clause'],
	['n', 'NP'],
	['N', 'Noun'],
	['v', 'VP'],
	['V', 'Verb'],
	['j', 'AdjP'],
	['A', 'Adjective'],
	['d', 'AdvP'],
	['a', 'Adverb'],
	['P', 'Adposition'],
	['C', 'Conjunction'],
	['r', 'Particle'],
	['p', 'Phrasal'],
	['.', 'period'],
])

const WORD_ENTITY_TYPES = new Set(['N', 'V', 'A', 'a', 'P', 'C', 'r', 'p'])

/**
 * The phase_2_encoding looks something like:
 * ~\wd ~\tg c-IDp00NNNNNNNNNNNNN.............~\lu {~\wd ~\tg C-1A.....~\lu then~\wd ~\tg n-SAN.N........~\lu (...
 *
 * If present, the first character of the features indicates the 'entity' type.
 * This could be a clause/phrase boundary, part of speech, or even certain punctuation.
 *
 * '{' and '}' indicate a main clause boundary
 * '[' and ']' indicate a subordinate clause boundary
 * '(' and ')' indicate a phrase boundary
 *
 * Examples:
 * ~\wd ~\tg c-IDp00NNNNNNNNNNNNN.............~\lu {    => { type: 'c', label: 'Clause', features: 'IDp00NNNNNNNNNNNNN.............', value: '{' }
 * ~\wd ~\tg N-1A1SDAnK3NN........~\lu God  => { type: 'N', label: 'Noun', features: '1A1SDAnK3NN........', value: 'God' }
 * ~\wd ~\tg v-S.....~\lu (     => { type: 'v', label: 'VP', features: 'S.....', value: '(' }
 * ~\wd ~\tg C-1A.....~\lu then => { type: 'C', label: 'Conjunction', features: '1A.....', value: 'then' }
 * ~\wd ~\tg ~\lu )             => { type: '', label: '', features: '', value: ')' }
 * ~\wd ~\tg .-~\lu .           => { type: '.', label: 'period', features: '', value: '.' }
 */
export function transform_semantic_encoding(semantic_encoding: string): SourceEntity[] {
	const EXTRACT_TYPE_FEATURES_VALUES = /~\\wd ~\\tg (?:([\w.])-([^~]*))?~\\lu ([^~]+)/g
	const entities = [...semantic_encoding.matchAll(EXTRACT_TYPE_FEATURES_VALUES)]

	return entities.map(decode_entity)

	// ['~\wd ~\tg N-1A1SDAnK3NN........~\lu God', 'N', '1A1SDAnK3NN........', 'God']
	function decode_entity(entity_match: RegExpMatchArray): SourceEntity {
		const type = entity_match[1] ?? ''
		const features = entity_match[2] ?? ''
		const value = entity_match[3]
		const label = ENTITY_LABEL_LOOKUP.get(type) || ''
		const sense = WORD_ENTITY_TYPES.has(type) ? features[1] : ''

		return {
			type,
			label,
			features,
			sense,
			value,
		}
	}
}
