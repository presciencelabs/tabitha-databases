import Database from 'bun:sqlite'
import { find_word_context } from './example_context'
import { transform_semantic_encoding } from './semantic_encoding'

const books = new Map<number, string>([
	[1, 'Genesis'],
	[2, 'Exodus'],
	[3, 'Leviticus'],
	[4, 'Numbers'],
	[5, 'Deuteronomy'],
	[6, 'Joshua'],
	[7, 'Judges'],
	[8, 'Ruth'],
	[9, '1 Samuel'],
	[10, '2 Samuel'],
	[11, '1 Kings'],
	[12, '2 Kings'],
	[13, '1 Chronicles'],
	[14, '2 Chronicles'],
	[15, 'Ezra'],
	[16, 'Nehemiah'],
	[17, 'Esther'],
	[18, 'Job'],
	[19, 'Psalms'],
	[20, 'Proverbs'],
	[21, 'Ecclesiastes'],
	[22, 'Song of Solomon'],
	[23, 'Isaiah'],
	[24, 'Jeremiah'],
	[25, 'Lamentations'],
	[26, 'Ezekiel'],
	[27, 'Daniel'],
	[28, 'Hosea'],
	[29, 'Joel'],
	[30, 'Amos'],
	[31, 'Obadiah'],
	[32, 'Jonah'],
	[33, 'Micah'],
	[34, 'Nahum'],
	[35, 'Habakkuk'],
	[36, 'Zephaniah'],
	[37, 'Haggai'],
	[38, 'Zechariah'],
	[39, 'Malachi'],
	[40, 'Matthew'],
	[41, 'Mark'],
	[42, 'Luke'],
	[43, 'John'],
	[44, 'Acts'],
	[45, 'Romans'],
	[46, '1 Corinthians'],
	[47, '2 Corinthians'],
	[48, 'Galatians'],
	[49, 'Ephesians'],
	[50, 'Philippians'],
	[51, 'Colossians'],
	[52, '1 Thessalonians'],
	[53, '2 Thessalonians'],
	[54, '1 Timothy'],
	[55, '2 Timothy'],
	[56, 'Titus'],
	[57, 'Philemon'],
	[58, 'Hebrews'],
	[59, 'James'],
	[60, '1 Peter'],
	[61, '2 Peter'],
	[62, '1 John'],
	[63, '2 John'],
	[64, '3 John'],
	[65, 'Jude'],
	[66, 'Revelation'],
])

export async function load_examples(db_ontology: Database, db_sources: Database, db_sources_complex: Database) {
	create_reference_lookup_table(db_ontology)
	create_or_clear_examples_table(db_ontology)
	await find_exhaustive_occurrences(db_ontology, db_sources, db_sources_complex)
	update_occurrences(db_ontology)

	show_examples(db_ontology)
	show_top_occurrences(db_ontology)
}

function create_reference_lookup_table(db_ontology: Database) {
	console.log(`Creating Reference_Lookup table in ${db_ontology.filename}...`)

	db_ontology.run(`
		CREATE TABLE IF NOT EXISTS Reference_Primary_Lookup (
			type	TEXT,
			id		INTEGER,
			name	TEXT
		)
	`)

	db_ontology.transaction(() => {
		const insert_stmt = db_ontology.prepare('INSERT INTO Reference_Primary_Lookup (type, id, name) VALUES (?,?,?) ON CONFLICT(rowid) DO NOTHING')

		for (const [id, name] of books) {
			insert_stmt.run('Bible', id, name)
		}
	})()

	console.log('done.')
}

function create_or_clear_examples_table(db_ontology: Database) {
	console.log(`Creating and/or clearing Exhaustive_Examples table in ${db_ontology.filename}...`)

	db_ontology.run(`
		CREATE TABLE IF NOT EXISTS Exhaustive_Examples (
			concept_stem				TEXT,
			concept_sense				TEXT,
			concept_part_of_speech	TEXT,
			ref_type						TEXT,
			ref_id_primary				INTEGER,
			ref_id_secondary			INTEGER,
			ref_id_tertiary			INTEGER,
			context_json				TEXT
		)
	`)

	db_ontology.run('DELETE FROM Exhaustive_Examples')
	db_ontology.run('UPDATE Concepts SET occurrences = 0')

	console.log('done.')
}

/**
 * 
 * @param db_ontology The Tabitha ontology database
 * @param db_sources The Tabitha sources database
 * @param db_sources_complex The Tabitha sources database after Complex Concept Insertion rules have been applied
 */
async function find_exhaustive_occurrences(db_ontology: Database, db_sources: Database, db_sources_complex: Database) {
	console.log('Fetching all source encoding...')
	type Source = {
		type: string
		id_primary: string
		id_secondary: string
		id_tertiary: string
		semantic_encoding: string
	}
	const all_sources = db_sources.query<Source, []>(`
		SELECT type, id_primary, id_secondary, id_tertiary, semantic_encoding
		FROM Sources
		WHERE semantic_encoding <> ''
	`).all()
	console.log(`Fetched ${all_sources.length} verses`)

	// For tracking how complex concepts are handled, we need to know which concepts are complex
	const all_complex_concepts = db_ontology.query<Concept, []>(`
		SELECT stem, sense, part_of_speech
		FROM Concepts
		WHERE level = 2 OR level = 3
	`).all()
	const complex_concept_set = new Set(all_complex_concepts.map(c => `${c.stem}|${c.sense}|${c.part_of_speech}`))
	console.log(`Found ${complex_concept_set.size} complex concepts`)

	let current_reference: SourceReference = { type: '', id_primary: '', id_secondary: '', id_tertiary: '' }
	for (const { semantic_encoding, type, id_primary, id_secondary, id_tertiary } of all_sources) {
		if (id_primary !== current_reference.id_primary) {
			console.log()
			console.log(`Collecting occurrences within ${id_primary}:`)
		}

		if (id_secondary !== current_reference.id_secondary) {
			// This is helpful to identify verses where an error occurs
			await Bun.write(Bun.stdout, id_secondary)
		}

		current_reference = { type, id_primary, id_secondary, id_tertiary }

		// For each word encountered, add the current verse reference to that word's examples
		const base_contexts = transform_semantic_encoding(semantic_encoding, complex_concept_set)
			.flatMap((_, index, source_entities) => find_word_context(index, source_entities))
		record_occurrences(db_ontology, current_reference, base_contexts)

		// Find the occurrences of complex concepts that were explicated. db_sources_complex contains the verses after
		// the Complex Concept Insertion rules have been applied. Pairings have also been reduced to just the complex word.
		const complex_verse = db_sources_complex.query<{ semantic_encoding: string }, string[]>(`
			SELECT semantic_encoding
			FROM Sources
			WHERE type = ? AND id_primary = ? AND id_secondary LIKE ? AND id_tertiary LIKE ?
		`).get(type, id_primary, id_secondary, id_tertiary)
		if (complex_verse) {
			function normalize_complex_contexts_for_comparison(contexts: [Concept, ContextArguments][]): [Concept, string][] {
				return contexts
					.filter(([concept]) => concept.is_complex)
					.map(([concept, context]) => [
						concept,
						JSON.stringify(context)
							// remove the Pairing and Complex Handling values for comparison purposes
							.replaceAll(/,\s*"(Pairing|Complex Handling)":\s*".*?"/g, '')
							// remove the simple word of any pairing found so we're only comparing the complex word
							.replaceAll(/"[^"]*?[/\\]/g, '"'),
					])
			}

			const complex_contexts = transform_semantic_encoding(complex_verse.semantic_encoding, complex_concept_set)
				.flatMap((entity, index, source_entities) => entity.concept?.is_complex ? find_word_context(index, source_entities) : [])
			const normalized_complex_contexts = normalize_complex_contexts_for_comparison(complex_contexts)
			const normalized_base_contexts = normalize_complex_contexts_for_comparison(base_contexts)
			
			// This isn't a perfect solution because there may be multiple occurrences with the same context, and it (rarely) may also falsely identify an unmatched context.
			const unmatched_complex = normalized_complex_contexts.filter(([c, json]) => !normalized_base_contexts.some(([bc, bjson]) => c.stem === bc.stem && c.sense === bc.sense && c.part_of_speech === bc.part_of_speech && json === bjson))

			const explicated_contexts = unmatched_complex.map(([concept, context]) => [concept, { ...JSON.parse(context), 'Complex Handling': 'Explication' }] as [Concept, ContextArguments])
			if (explicated_contexts.length > 0) {
				record_occurrences(db_ontology, current_reference, explicated_contexts)
			}
		}

		const progress_char = id_tertiary.endsWith('0') ? '_' : '.'	// easier to count the verses this way
		await Bun.write(Bun.stdout, progress_char)
	}

	console.log()
	console.log('done!')
}

function record_occurrences(db_ontology: Database, reference: SourceReference, contexts: [Concept, ContextArguments][]) {
	// doing the insertions in a transaction is much faster
	db_ontology.transaction(() => {
		for (const [concept, context] of contexts) {
			record_occurrence(db_ontology, concept, reference, context)
		}
	})()
}

function record_occurrence(db_ontology: Database, concept: Concept, reference: SourceReference, context: ContextArguments) {
	const { stem, sense, part_of_speech } = concept
	const { type, id_primary, id_secondary, id_tertiary } = reference
	// using query() caches the statement, making this faster for bulk inserts
	db_ontology.query(`
		INSERT INTO Exhaustive_Examples (concept_stem, concept_sense, concept_part_of_speech, ref_type, ref_id_primary, ref_id_secondary, ref_id_tertiary, context_json)
		SELECT ?, ?, ?, ?, id, ?, ?, ?
		FROM Reference_Primary_Lookup
		WHERE type = ? AND name = ?
	`).run(stem, sense, part_of_speech, type, id_secondary, id_tertiary, JSON.stringify(context), type, id_primary)
}

async function update_occurrences(db_ontology: Database) {
	console.log('Updating occurrences count for each concept...')

	db_ontology.run(`
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
	`)

	console.log('done!')
}

function show_examples(db_ontology: Database) {
	console.log()
	console.log('======= Noun Examples =======')
	// destination role; outer noun & adposition; destination role & adposition
	show_examples({ stem: 'Moab', sense: 'A', part_of_speech: 'Noun' }, { type: 'Bible', ref_id_primary: 8, ref_id_secondary: 1, ref_id_tertiary: 1 })
	// outer adjective
	show_examples({ stem: 'husband', sense: 'A', part_of_speech: 'Noun' }, { type: 'Bible', ref_id_primary: 8, ref_id_secondary: 1, ref_id_tertiary: 8 })

	console.log('======= Verb Examples =======')
	// coordinate agent & source & destination
	show_examples({ stem: 'move', sense: 'A', part_of_speech: 'Verb' }, { type: 'Bible', ref_id_primary: 8, ref_id_secondary: 1, ref_id_tertiary: 1 })
	// negative polarity & predicate adjective
	show_examples({ stem: 'be', sense: 'D', part_of_speech: 'Verb' }, { type: 'Bible', ref_id_primary: 8, ref_id_secondary: 1, ref_id_tertiary: 12 })
	// negative polarity & patient proposition
	show_examples({ stem: 'tell', sense: 'B', part_of_speech: 'Verb' }, { type: 'Bible', ref_id_primary: 8, ref_id_secondary: 1, ref_id_tertiary: 16 })
	// most patient-like
	show_examples({ stem: 'bury', sense: 'A', part_of_speech: 'Verb' }, { type: 'Bible', ref_id_primary: 8, ref_id_secondary: 1, ref_id_tertiary: 17 })
	// agent proposition & predicate adjective
	show_examples({ stem: 'be', sense: 'V', part_of_speech: 'Verb' }, { type: 'Bible', ref_id_primary: 1, ref_id_secondary: 2, ref_id_tertiary: 18 })
	// complex pairing
	show_examples({ stem: 'cry', sense: 'A', part_of_speech: 'Verb' }, { type: 'Bible', ref_id_primary: 8, ref_id_secondary: 1, ref_id_tertiary: 14 })
	show_examples({ stem: 'weep', sense: 'A', part_of_speech: 'Verb' }, { type: 'Bible', ref_id_primary: 8, ref_id_secondary: 1, ref_id_tertiary: 14 })

	console.log('======= Adjective Examples =======')
	// modified noun
	show_examples({ stem: 'much-many', sense: 'A', part_of_speech: 'Adjective' }, { type: 'Bible', ref_id_primary: 8, ref_id_secondary: 1, ref_id_tertiary: 1 })
	// patient noun
	show_examples({ stem: 'kind', sense: 'B', part_of_speech: 'Adjective' }, { type: 'Bible', ref_id_primary: 8, ref_id_secondary: 1, ref_id_tertiary: 8 })
	// patient clause
	show_examples({ stem: 'able', sense: 'A', part_of_speech: 'Adjective' }, { type: 'Bible', ref_id_primary: 8, ref_id_secondary: 1, ref_id_tertiary: 12 })
	// 'too' degree
	show_examples({ stem: 'old', sense: 'A', part_of_speech: 'Adjective' }, { type: 'Bible', ref_id_primary: 8, ref_id_secondary: 1, ref_id_tertiary: 12 })
	// comparative degree & patient noun
	show_examples({ stem: 'good', sense: 'A', part_of_speech: 'Adjective' }, { type: 'Bible', ref_id_primary: 8, ref_id_secondary: 4, ref_id_tertiary: 15 })
	// complex pairing
	show_examples({ stem: 'sad', sense: 'A', part_of_speech: 'Adjective' }, { type: 'Bible', ref_id_primary: 8, ref_id_secondary: 1, ref_id_tertiary: 13 })
	show_examples({ stem: 'bitter', sense: 'B', part_of_speech: 'Adjective' }, { type: 'Bible', ref_id_primary: 8, ref_id_secondary: 1, ref_id_tertiary: 13 })

	console.log('======= Adverb Examples =======')
	// modified noun
	show_examples({ stem: 'also', sense: 'C', part_of_speech: 'Adverb' }, { type: 'Bible', ref_id_primary: 8, ref_id_secondary: 1, ref_id_tertiary: 5 })
	// intensified degree
	show_examples({ stem: 'kindly', sense: 'A', part_of_speech: 'Adverb' }, { type: 'Bible', ref_id_primary: 8, ref_id_secondary: 2, ref_id_tertiary: 13 })
	// comparative degree
	show_examples({ stem: 'hard', sense: 'A', part_of_speech: 'Adverb' }, { type: 'Bible', ref_id_primary: 32, ref_id_secondary: 1, ref_id_tertiary: 11 })

	console.log('======= Adposition Examples =======')
	// no argument
	show_examples({ stem: 'when', sense: 'C', part_of_speech: 'Adposition' }, { type: 'Bible', ref_id_primary: 8, ref_id_secondary: 1, ref_id_tertiary: 1 })
	// noun & verb
	show_examples({ stem: 'in', sense: 'B', part_of_speech: 'Adposition' }, { type: 'Bible', ref_id_primary: 8, ref_id_secondary: 1, ref_id_tertiary: 1 })
	// noun & outer noun
	show_examples({ stem: '-Name', sense: 'A', part_of_speech: 'Adposition' }, { type: 'Bible', ref_id_primary: 8, ref_id_secondary: 1, ref_id_tertiary: 1 })
	// adjective & outer noun
	show_examples({ stem: '-Subgroup', sense: 'A', part_of_speech: 'Adposition' }, { type: 'Bible', ref_id_primary: 8, ref_id_secondary: 2, ref_id_tertiary: 11 })

	console.log('======= Conjunction Examples =======')
	// no argument (within NP)
	show_examples({ stem: 'and', sense: 'B', part_of_speech: 'Conjunction' }, { type: 'Bible', ref_id_primary: 8, ref_id_secondary: 1, ref_id_tertiary: 2 })
	// no argument (within Clause)
	show_examples({ stem: 'but', sense: 'A', part_of_speech: 'Conjunction' }, { type: 'Bible', ref_id_primary: 8, ref_id_secondary: 1, ref_id_tertiary: 2 })

	function show_examples({ stem, sense, part_of_speech }: Concept, { ref_id_primary, ref_id_secondary, ref_id_tertiary }: ExampleReference) {
		type ExampleContext = {
			context_json: string
		}
		const examples = db_ontology.query<ExampleContext, (string|number)[]>(`
			SELECT context_json
			FROM Exhaustive_Examples
			WHERE concept_stem = ? AND concept_sense = ? AND concept_part_of_speech = ? AND ref_id_primary = ? AND ref_id_secondary = ? AND ref_id_tertiary = ?
		`).all(stem, sense, part_of_speech, ref_id_primary, ref_id_secondary, ref_id_tertiary)

		console.log(`––– ${stem}–${sense} in ${books.get(ref_id_primary)} ${ref_id_secondary}:${ref_id_tertiary} –––`)
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
	const top_occurrences = db_ontology.query<OccurrenceData, []>(`
		SELECT stem, sense, part_of_speech, occurrences
		FROM Concepts
		ORDER BY occurrences + 0 DESC
		LIMIT 10
	`).all()

	console.table(top_occurrences)
}
