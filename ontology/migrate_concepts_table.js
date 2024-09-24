export function migrate_concepts_table(tbta_db, tabitha_db) {
	const transformed_data = transform_tbta_data(tbta_db)

	create_tabitha_table(tabitha_db)

	load_data(tabitha_db, transformed_data)
}

/** @param {import('bun:sqlite').Database} tbta_db */
function transform_tbta_data(tbta_db) {
	console.log(`Transforming data from ${tbta_db.filename}...`)

	const table_name_part_of_speech_map = [
		['Adjectives'	, 'Adjective'],
		['Adpositions'	, 'Adposition'],
		['Adverbs'		, 'Adverb'],
		['Conjunctions', 'Conjunction'],
		['Nouns'			, 'Noun'],
		['Particles'	, 'Particle'],
		['Pronouns'		, 'Phrasal'],
		['Verbs'			, 'Verb'],
	]

	const transformed_data = table_name_part_of_speech_map.map(([table_name, part_of_speech]) => tbta_db.query(`
			SELECT	ID								AS id,
						Roots							AS stem,
						''								AS sense,
						'${part_of_speech}'		AS part_of_speech,
						0						AS occurrences,
						"LN Gloss"					AS gloss,
						"Brief Gloss"				AS brief_gloss,
						Categories					AS categorization,
						Examples 					AS curated_examples,
						Level							AS level

			FROM ${table_name}
		`).all()
	).flat() // flattens each of the part of speech results into a single array of all concepts

	console.log('done.')

	return transformed_data
}

/** @param {import('bun:sqlite').Database} tabitha_db */
function create_tabitha_table(tabitha_db) {
	console.log(`Creating Concepts table in ${tabitha_db.filename}...`)

	tabitha_db.query(`
		CREATE TABLE IF NOT EXISTS Concepts (
			id						INTEGER,
			stem					TEXT,
			sense					TEXT,
			part_of_speech		TEXT,
			occurrences			TEXT,
			gloss					TEXT,
			brief_gloss			TEXT,
			categorization		TEXT,
			curated_examples	TEXT,
			level					INTEGER
		)
	`).run()

	console.log('done.')
}

/** @param {import('bun:sqlite').Database} tabitha_db */
function load_data(tabitha_db, transformed_data) {
	console.log(`Loading data into Concepts table...`)

	transformed_data.map(async ({id, stem, part_of_speech, occurrences, gloss, brief_gloss, categorization, curated_examples, level}) => {
		tabitha_db.query(`
			INSERT INTO Concepts (id, stem, part_of_speech, occurrences, gloss, brief_gloss, categorization, curated_examples, level)
			VALUES (?,?,?,?,?,?,?,?,?,?)
		`).run(id, stem, part_of_speech, occurrences, gloss, brief_gloss, categorization, curated_examples, level)

		await Bun.write(Bun.stdout, '.')
	})

	console.log('done.')
}
