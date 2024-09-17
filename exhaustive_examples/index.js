import { find_word_context } from './example_context'
import { transform_semantic_encoding } from './semantic_encoding'
import { Database } from 'bun:sqlite'

// usage: `bun exhaustive_examples/index.js Ontology.VERSION.YYYY-MM-DD.tabitha.sqlite Sources.YYYY-MM-DD.tabitha.sqlite`
const ontology_db_name	 = Bun.argv[2]	// Ontology.VERSION.YYYY-MM-DD.tabitha.sqlite
const sources_db_name = Bun.argv[3]	// Sources.YYYY-MM-DD.tabitha.sqlite

// the databases are currently expected to be in the root folder of the repo
const db_ontology = new Database(ontology_db_name)
const db_sources = new Database(sources_db_name)

db_ontology.exec('PRAGMA journal_mode = WAL')

await find_exhaustive_occurrences(db_sources, db_ontology)

show_examples(db_ontology)

/**
 * 
 * @param {Database} db_sources 
 * @param {Database} db_ontology 
 */
async function find_exhaustive_occurrences(db_sources, db_ontology) {
	db_ontology.query('UPDATE Concepts SET examples = "", occurrences = 0').run()

	console.log('Fetching all source encoding...')
	const all_sources = db_sources.query(`
		SELECT type, id_primary, id_secondary, id_tertiary, semantic_encoding
		FROM Sources
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
				const examples = context_arguments.map(context => JSON.stringify({ reference, context })).join('\n')
				const { stem, sense, part_of_speech } = JSON.parse(concept_key)
				
				// TODO only update the concepts every chapter/book instead of every verse?
				db_ontology.query(`
					UPDATE Concepts
					SET examples = examples || ?, occurrences = occurrences + ?
					WHERE stem = ? AND sense = ? AND part_of_speech = ?
				`).run(`${examples}\n`, examples.length, stem, sense, part_of_speech)
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
function show_examples(db_ontology) {
	console.log()
	console.log('======= Noun Examples =======')
	// destination role; outer noun & adposition; destination role & adposition
	show_examples({ stem: 'Moab', sense: 'A', part_of_speech: 'Noun' }, { type: 'Bible', id_primary: 'Ruth', id_secondary: '1', id_tertiary: '1' })
	// outer adjective
	show_examples({ stem: 'husband', sense: 'A', part_of_speech: 'Noun' }, { type: 'Bible', id_primary: 'Ruth', id_secondary: '1', id_tertiary: '8' })

	console.log('======= Verb Examples =======')
	// coordinate agent & source & destination
	show_examples({ stem: 'move', sense: 'A', part_of_speech: 'Verb' }, { type: 'Bible', id_primary: 'Ruth', id_secondary: '1', id_tertiary: '1' })
	// negative polarity & predicate adjective
	show_examples({ stem: 'be', sense: 'D', part_of_speech: 'Verb' }, { type: 'Bible', id_primary: 'Ruth', id_secondary: '1', id_tertiary: '12' })
	// negative polarity & patient proposition
	show_examples({ stem: 'tell', sense: 'B', part_of_speech: 'Verb' }, { type: 'Bible', id_primary: 'Ruth', id_secondary: '1', id_tertiary: '16' })
	// most patient-like
	show_examples({ stem: 'bury', sense: 'A', part_of_speech: 'Verb' }, { type: 'Bible', id_primary: 'Ruth', id_secondary: '1', id_tertiary: '17' })
	// agent proposition & predicate adjective
	show_examples({ stem: 'be', sense: 'V', part_of_speech: 'Verb' }, { type: 'Grammar Introduction', id_primary: 'Clauses', id_secondary: '1', id_tertiary: '67' })

	console.log('======= Adjective Examples =======')
	// modified noun
	show_examples({ stem: 'much-many', sense: 'A', part_of_speech: 'Adjective' }, { type: 'Bible', id_primary: 'Ruth', id_secondary: '1', id_tertiary: '1' })
	// patient noun
	show_examples({ stem: 'kind', sense: 'B', part_of_speech: 'Adjective' }, { type: 'Bible', id_primary: 'Ruth', id_secondary: '1', id_tertiary: '8' })
	// patient clause
	show_examples({ stem: 'able', sense: 'A', part_of_speech: 'Adjective' }, { type: 'Bible', id_primary: 'Ruth', id_secondary: '1', id_tertiary: '12' })
	// 'too' degree
	show_examples({ stem: 'old', sense: 'A', part_of_speech: 'Adjective' }, { type: 'Bible', id_primary: 'Ruth', id_secondary: '1', id_tertiary: '12' })
	// comparative degree & patient noun
	show_examples({ stem: 'good', sense: 'A', part_of_speech: 'Adjective' }, { type: 'Bible', id_primary: 'Ruth', id_secondary: '4', id_tertiary: '15' })

	console.log('======= Adverb Examples =======')
	// modified noun
	show_examples({ stem: 'also', sense: 'C', part_of_speech: 'Adverb' }, { type: 'Bible', id_primary: 'Ruth', id_secondary: '1', id_tertiary: '5' })
	// intensified degree
	show_examples({ stem: 'kindly', sense: 'A', part_of_speech: 'Adverb' }, { type: 'Bible', id_primary: 'Ruth', id_secondary: '2', id_tertiary: '13' })
	// comparative degree
	show_examples({ stem: 'hard', sense: 'A', part_of_speech: 'Adverb' }, { type: 'Bible', id_primary: 'Jonah', id_secondary: '1', id_tertiary: '11' })

	console.log('======= Adposition Examples =======')
	// no argument
	show_examples({ stem: 'when', sense: 'C', part_of_speech: 'Adposition' }, { type: 'Bible', id_primary: 'Ruth', id_secondary: '1', id_tertiary: '1' })
	// noun & verb
	show_examples({ stem: 'in', sense: 'B', part_of_speech: 'Adposition' }, { type: 'Bible', id_primary: 'Ruth', id_secondary: '1', id_tertiary: '1' })
	// noun & outer noun
	show_examples({ stem: '-Name', sense: 'A', part_of_speech: 'Adposition' }, { type: 'Bible', id_primary: 'Ruth', id_secondary: '1', id_tertiary: '1' })
	// adjective & outer noun
	show_examples({ stem: '-Subgroup', sense: 'A', part_of_speech: 'Adposition' }, { type: 'Bible', id_primary: 'Ruth', id_secondary: '2', id_tertiary: '11' })

	console.log('======= Conjunction Examples =======')
	// no argument (within NP)
	show_examples({ stem: 'and', sense: 'B', part_of_speech: 'Conjunction' }, { type: 'Bible', id_primary: 'Ruth', id_secondary: '1', id_tertiary: '2' })
	// no argument (within Clause)
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
