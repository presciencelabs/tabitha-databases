import { find_word_context } from './argument_context'
import { transform_semantic_encoding } from './semantic_encoding'
import { Database } from 'bun:sqlite'

const db_sources = new Database('Sources.2024-07-09.tabitha.sqlite')
const db_ontology = new Database('Ontology.9489.2024-06-31.tabitha.sqlite')

db_sources.exec('PRAGMA journal_mode = WAL')
db_ontology.exec('PRAGMA journal_mode = WAL')

await find_exhaustive_occurrences(db_sources, db_ontology)

summarize(db_ontology)

/**
 * 
 * @param {Database} db_sources 
 * @param {Database} db_ontology 
 */
async function find_exhaustive_occurrences(db_sources, db_ontology) {
	// Clear all examples from DB
	db_ontology.query('UPDATE Concepts SET examples = "", occurrences = 0').run()

	// Loop through each verse
	console.log('Fetching all source encoding...')
	const all_sources = db_sources.query(`
		SELECT type, id_primary, id_secondary, id_tertiary, semantic_encoding
		FROM Sources
		--WHERE id_primary IN ('Ruth', 'Jonah', 'Clauses')
	`).all()

	console.log(`Fetched ${all_sources.length} verses`)

	let current_book = ''
	for (const { semantic_encoding, ...reference } of all_sources) {
		if (reference.id_primary !== current_book) {
			current_book = reference.id_primary
			console.log()
			console.log(`Collecting occurrences within ${current_book}:`)
		}

		// For each word encountered, add the current verse reference to that word's examples
		transform_semantic_encoding(semantic_encoding)
			.reduce(group_examples_by_concept, new Map())
			.forEach((context_arguments, concept_key) => {
				const new_examples = context_arguments.map(context => JSON.stringify({ reference, context })).join('\n')
				const concept = JSON.parse(concept_key)
				
				// TODO only update the concepts every chapter instead of every verse?
				db_ontology.query(`
					UPDATE Concepts
					SET examples = examples || ?, occurrences = occurrences + ?
					WHERE stem = ? AND sense = ? AND part_of_speech = ?
				`).run(`${new_examples}\n`, context_arguments.length, concept.stem, concept.sense, concept.part_of_speech)
			})

		await Bun.write(Bun.stdout, '.')
	}

	console.log()
	console.log('done!')

	console.log('Optimizing Ontology db...')
	db_ontology.query('VACUUM').run()
	console.log('done.')
}

/**
 * 
 * @param {Map<Concept, ContextArguments[]>} concept_map 
 * @param {SourceEntity} entity 
 * @param {number} index 
 * @param {SourceEntity[]} source_entities 
 * @returns 
 */
function group_examples_by_concept(concept_map, entity, index, source_entities) {
	if (!entity.sense) {
		return concept_map
	}

	const concept = JSON.stringify({
		stem: entity.value,
		sense: entity.sense,
		part_of_speech: entity.label,
	})

	const context_arguments = find_word_context(index, source_entities)
	const examples = concept_map.get(concept) ?? []
	examples.push(context_arguments)
	concept_map.set(concept, examples)

	return concept_map
}

/**
 * 
 * @param {Database} db_ontology 
 */
function summarize(db_ontology) {
	console.log('======= Noun Examples =======')
	show_examples({ stem: 'Moab', sense: 'A', part_of_speech: 'Noun' }, { type: 'Bible', id_primary: 'Ruth', id_secondary: '1', id_tertiary: '1' })
	show_examples({ stem: 'husband', sense: 'A', part_of_speech: 'Noun' }, { type: 'Bible', id_primary: 'Ruth', id_secondary: '1', id_tertiary: '8' })

	console.log('======= Verb Examples =======')
	show_examples({ stem: 'move', sense: 'A', part_of_speech: 'Verb' }, { type: 'Bible', id_primary: 'Ruth', id_secondary: '1', id_tertiary: '1' })
	show_examples({ stem: 'be', sense: 'D', part_of_speech: 'Verb' }, { type: 'Bible', id_primary: 'Ruth', id_secondary: '1', id_tertiary: '12' })
	show_examples({ stem: 'tell', sense: 'B', part_of_speech: 'Verb' }, { type: 'Bible', id_primary: 'Ruth', id_secondary: '1', id_tertiary: '16' })
	show_examples({ stem: 'bury', sense: 'A', part_of_speech: 'Verb' }, { type: 'Bible', id_primary: 'Ruth', id_secondary: '1', id_tertiary: '17' })
	show_examples({ stem: 'wait', sense: 'B', part_of_speech: 'Verb' }, { type: 'Bible', id_primary: 'Ruth', id_secondary: '3', id_tertiary: '3' })
	show_examples({ stem: 'be', sense: 'V', part_of_speech: 'Verb' }, { type: 'Grammar Introduction', id_primary: 'Clauses', id_secondary: '1', id_tertiary: '67' })

	console.log('======= Adjective Examples =======')
	show_examples({ stem: 'much-many', sense: 'A', part_of_speech: 'Adjective' }, { type: 'Bible', id_primary: 'Ruth', id_secondary: '1', id_tertiary: '1' })
	show_examples({ stem: 'kind', sense: 'B', part_of_speech: 'Adjective' }, { type: 'Bible', id_primary: 'Ruth', id_secondary: '1', id_tertiary: '8' })
	show_examples({ stem: 'able', sense: 'A', part_of_speech: 'Adjective' }, { type: 'Bible', id_primary: 'Ruth', id_secondary: '1', id_tertiary: '12' })
	show_examples({ stem: 'old', sense: 'A', part_of_speech: 'Adjective' }, { type: 'Bible', id_primary: 'Ruth', id_secondary: '1', id_tertiary: '12' })
	show_examples({ stem: 'good', sense: 'A', part_of_speech: 'Adjective' }, { type: 'Bible', id_primary: 'Ruth', id_secondary: '4', id_tertiary: '15' })

	console.log('======= Adverb Examples =======')
	show_examples({ stem: 'also', sense: 'C', part_of_speech: 'Adverb' }, { type: 'Bible', id_primary: 'Ruth', id_secondary: '1', id_tertiary: '5' })
	show_examples({ stem: 'kindly', sense: 'A', part_of_speech: 'Adverb' }, { type: 'Bible', id_primary: 'Ruth', id_secondary: '2', id_tertiary: '13' })
	show_examples({ stem: 'hard', sense: 'A', part_of_speech: 'Adverb' }, { type: 'Bible', id_primary: 'Jonah', id_secondary: '1', id_tertiary: '11' })

	console.log('======= Adposition Examples =======')
	show_examples({ stem: 'when', sense: 'C', part_of_speech: 'Adposition' }, { type: 'Bible', id_primary: 'Ruth', id_secondary: '1', id_tertiary: '1' })
	show_examples({ stem: 'in', sense: 'B', part_of_speech: 'Adposition' }, { type: 'Bible', id_primary: 'Ruth', id_secondary: '1', id_tertiary: '1' })
	show_examples({ stem: '-Name', sense: 'A', part_of_speech: 'Adposition' }, { type: 'Bible', id_primary: 'Ruth', id_secondary: '1', id_tertiary: '1' })
	show_examples({ stem: '-Subgroup', sense: 'A', part_of_speech: 'Adposition' }, { type: 'Bible', id_primary: 'Ruth', id_secondary: '2', id_tertiary: '11' })

	console.log('======= Conjunction Examples =======')
	show_examples({ stem: 'and', sense: 'B', part_of_speech: 'Conjunction' }, { type: 'Bible', id_primary: 'Ruth', id_secondary: '1', id_tertiary: '2' })
	show_examples({ stem: 'but', sense: 'A', part_of_speech: 'Conjunction' }, { type: 'Bible', id_primary: 'Ruth', id_secondary: '1', id_tertiary: '2' })

	/**
	 * 
	 * @param {Concept} concept 
	 * @param {Reference} reference 
	 */
	function show_examples(concept, reference) {
		const { examples } = db_ontology.query(`
			SELECT examples
			FROM Concepts
			WHERE stem = ? AND sense = ? AND part_of_speech = ?
		`).get(concept.stem, concept.sense, concept.part_of_speech)

		const reference_string = JSON.stringify(reference)
		const examples_to_show = examples.split('\n')
			.filter(example_json => example_json.includes(reference_string))
			.join('\n')

		console.log(`----- ${concept.stem}-${concept.sense} in ${reference.id_primary} ${reference.id_secondary}:${reference.id_tertiary} -----`)
		console.log(examples_to_show)
		console.log()
	}
}
