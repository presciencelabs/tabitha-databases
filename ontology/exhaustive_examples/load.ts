import Database, { type SQLQueryBindings } from 'bun:sqlite'
import { find_word_context } from './example_context'
import { transform_semantic_encoding } from './semantic_encoding'

export async function load_examples(db_ontology: Database, db_sources: Database) {
	create_or_clear_examples_table(db_ontology)
	await find_exhaustive_occurrences(db_sources, db_ontology)
	update_occurrences(db_ontology)

	show_examples(db_ontology)
	show_top_occurrences(db_ontology)
}

function create_or_clear_examples_table(db_ontology: Database) {
	console.log(`Creating and/or clearing Exhaustive_Examples table in ${db_ontology.filename}...`)

	db_ontology.query(`
		CREATE TABLE IF NOT EXISTS Exhaustive_Examples (
			concept_stem				TEXT,
			concept_sense				TEXT,
			concept_part_of_speech	TEXT,
			ref_type						TEXT,
			ref_id_primary				TEXT,
			ref_id_secondary			TEXT,
			ref_id_tertiary			TEXT,
			context_json				TEXT
		)
	`).run()

	db_ontology.query('DELETE FROM Exhaustive_Examples').run()
	db_ontology.query('UPDATE Concepts SET occurrences = 0').run()

	console.log('done.')
}

async function find_exhaustive_occurrences(db_sources: Database, db_ontology: Database) {
	console.log('Fetching all source encoding...')
	type Source = {
		type: string
		id_primary: string
		id_secondary: string
		id_tertiary: string
		semantic_encoding: string
	}
	const all_sources = db_sources.query<Source, SQLQueryBindings | SQLQueryBindings[]>(`
		SELECT type, id_primary, id_secondary, id_tertiary, semantic_encoding
		FROM Sources
	`).all()
	console.log(`Fetched ${all_sources.length} verses`)

	let current_reference = { id_primary: '', id_secondary: '' }
	for (const { semantic_encoding, type, id_primary, id_secondary, id_tertiary } of all_sources) {
		if (id_primary !== current_reference.id_primary) {
			console.log()
			console.log(`Collecting occurrences within ${id_primary}:`)
		}

		if (id_secondary !== current_reference.id_secondary) {
			// This is helpful to identify verses where an error occurs
			await Bun.write(Bun.stdout, id_secondary)
		}

		current_reference = { id_primary, id_secondary }

		// For each word encountered, add the current verse reference to that word's examples
		transform_semantic_encoding(semantic_encoding)
			.map((entity, index, source_entities) => entity.sense ? [entity, find_word_context(index, source_entities)] : [])
			.filter(pair => pair.length)
			.forEach(([entity, context]) => {
				const stem = entity.value.split('/')[0]	// remove a pairing
				db_ontology.query(`
					INSERT INTO Exhaustive_Examples (concept_stem, concept_sense, concept_part_of_speech, ref_type, ref_id_primary, ref_id_secondary, ref_id_tertiary, context_json)
					VALUES (?,?,?,?,?,?,?,?)
				`).run(stem, entity.sense, entity.label, type, id_primary, id_secondary, id_tertiary, JSON.stringify(context))
			})

		await Bun.write(Bun.stdout, '.')
	}

	console.log()
	console.log('done!')
}

async function update_occurrences(db_ontology: Database) {
	console.log('Updating occurrences count for each concept...')

	db_ontology.query(`
		UPDATE Concepts
		SET occurrences = Examples.occurrences
		FROM (
			SELECT	concept_stem AS stem,
						concept_sense AS sense,
						concept_part_of_speech AS part_of_speech,
						COUNT(context_json) AS occurrences
			FROM Exhaustive_Examples
			GROUP BY stem, sense, part_of_speech
		) AS Examples
		WHERE Concepts.stem = Examples.stem AND Concepts.sense = Examples.sense AND Concepts.part_of_speech = Examples.part_of_speech
	`).run()

	console.log('done!')
}

function show_examples(db_ontology: Database) {
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

	function show_examples({ stem, sense, part_of_speech }: Concept, { id_primary, id_secondary, id_tertiary }: Reference) {
		type ExampleContext = {
			context_json: string
		}
		const examples = db_ontology.query<ExampleContext, SQLQueryBindings | SQLQueryBindings[]>(`
			SELECT context_json
			FROM Exhaustive_Examples
			WHERE concept_stem = ? AND concept_sense = ? AND concept_part_of_speech = ? AND ref_id_primary = ? AND ref_id_secondary = ? AND ref_id_tertiary = ?
		`).all(stem, sense, part_of_speech, id_primary, id_secondary, id_tertiary)

		console.log(`----- ${stem}-${sense} in ${id_primary} ${id_secondary}:${id_tertiary} -----`)
		for (const { context_json } of examples) {
			console.log(context_json)
		}
		console.log()
	}
}

function show_top_occurrences(db_ontology: Database) {
	type OccurrenceData = {
		stem: string
		sense: string
		part_of_speech: string
		occurrences: number
	}
	const top_occurrences = db_ontology.query<OccurrenceData, SQLQueryBindings | SQLQueryBindings[]>(`
		SELECT stem, sense, part_of_speech, occurrences
		FROM Concepts
		ORDER BY occurrences + 0 DESC
		LIMIT 10
	`).all()

	console.table(top_occurrences)
}
