
/** @type {{ [string]: { [string]: Feature } }} */
export const FEATURES = {
	NP: {
		SEQUENCE: {
			index: 0,
			labels: {
				'S': 'Not in a Sequence',
				'F': 'First Coordinate',
				'L': 'Last Coordinate',
				'C': 'Coordinate',
			},
			letters: {
				'Not in a Sequence': 'S',
				'First Coordinate': 'F',
				'Last Coordinate': 'L',
				'Coordinate': 'C',
			},
		},
		SEMANTIC_ROLE: {
			index: 1,
			labels: {
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
			letters: {
				'Agent': 'A',
				'Patient': 'P',
				'State': 'S',
				'Source': 's',
				'Destination': 'd',
				'Beneficiary': 'B',
				'Instrument': 'I',
				'Addressee': 'D',
				'Oblique': 'N',
			},
		},
	},
	VERB: {
		POLARITY: {
			index: 6,
			labels: {
				'A': 'Affirmative',
				'N': 'Negative',
				'E': 'Emphatic Affirmative',
				'e': 'Emphatic Negative',
			},
			letters: {},
		},
	},
	ADJ: {
		DEGREE: {
			index: 2,
			labels: {
				'N': 'No Degree',
				'C': 'Comparative',
				'S': 'Superlative',
				'V': 'Intensified',
				'E': 'Extremely Intensified',
				'T': "'too'",
				'L': "'less'",
				'l': "'least'",
				'q': 'Equality',
				'i': 'Intensified Comparative',
				'c': "Intensified 'less'",
				's': 'Superlative of 2 items',
			},
			letters: {},	// unused
		},
	},
	ADJP: {
		SEQUENCE: {
			index: 0,
			labels: {
				'S': 'Not in a Sequence',
				'F': 'First Coordinate',
				'L': 'Last Coordinate',
				'C': 'Coordinate',
			},
			letters: {
				'Not in a Sequence': 'S',
				'First Coordinate': 'F',
				'Last Coordinate': 'L',
				'Coordinate': 'C',
			},
		},
		USAGE: {
			index: 1,
			labels: {
				'A': 'Attributive',
				'P': 'Predicative',
			},
			letters: {
				'Attributive': 'A',
				'Predicative': 'P',
			},
		},
	},
	ADV: {
		DEGREE: {
			index: 2,
			labels: {
				'N': 'No Degree',
				'C': 'Comparative',
				'S': 'Superlative',
				'V': 'Intensified',
				'E': 'Extremely Intensified',
				'T': "'too'",
				'L': "'less'",
				'l': "'least'",
			},
			letters: {},	// unused
		},
	},
	CLAUSE: {
		TYPE: {
			index: 0,
			labels: {
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
			letters: {
				'Independent': 'I',
				'Coordinate Independent': 'C',
				'Restrictive Relative Clause': 'T',
				'Descriptive Relative Clause': 't',
				'Adverbial Clause': 'E',
				'Propositional Agent': 'A',
				'Propositional Patient': 'P',
				'Attributive Patient': 'p',
				'Closing Quotation Frame': 'Q',
			},
		},
		TOPIC_NP: {
			index: 2,
			labels: {
				'p': 'Most Agent-Like',
				'P': 'Most Patient-Like',
			},
			letters: {},	// unused
		},
		SEQUENCE: {
			index: 12,
			labels: {
				'N': 'Not in a Sequence',
				'F': 'First Coordinate',
				'L': 'Last Coordinate',
				'C': 'Coordinate',
			},
			letters: {
				'Not in a Sequence': 'N',
				'First Coordinate': 'F',
				'Last Coordinate': 'L',
				'Coordinate': 'C',
			},
		},
	},
}

const ENTITY_LABELS = new Map([
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
 *
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
 *
 * @param {string} semantic_encoding
 *
 * @returns {SourceEntity[]}
 */
export function transform_semantic_encoding(semantic_encoding) {
	let entities = [...semantic_encoding.matchAll(/~\\wd ~\\tg (?:([\w.])-([^~]*))?~\\lu ([^~]+)/g)]

	return entities.map(decode_entity)

	/**
	 * @param {RegExpMatchArray} entity_match ['~\wd ~\tg N-1A1SDAnK3NN........~\lu God', 'N', '1A1SDAnK3NN........', 'God']
	 *
	 * @returns {SourceEntity}
	 */
	function decode_entity(entity_match) {
		const features = entity_match[2] ?? ''
		const value = entity_match[3]
		const type = entity_match[1] ?? ''
		const label = ENTITY_LABELS.get(type) || ''
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