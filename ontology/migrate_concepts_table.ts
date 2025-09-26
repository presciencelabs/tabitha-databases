import Database from 'bun:sqlite'

type TransformedData = {
	id: number
	stem: string
	sense: string
	part_of_speech: string
	occurrences: number
	gloss: string
	brief_gloss: string
	note: string
	categorization: string
	curated_examples: string
	level: number
}

export function migrate_concepts_table(tbta_db: Database, tabitha_db: Database) {
	const transformed_data: TransformedData[] = transform_tbta_data(tbta_db)

	create_tabitha_table(tabitha_db)

	load_data(tabitha_db, transformed_data)
}

function transform_tbta_data(tbta_db: Database): TransformedData[] {
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

	const transformed_data: TransformedData[] = table_name_part_of_speech_map.map(([table_name, part_of_speech]) => tbta_db.query<TransformedData, []>(`
			SELECT	ID							AS id,
						Roots						AS stem,
						''							AS sense,
						'${part_of_speech}'	AS part_of_speech,
						0							AS occurrences,
						"LN Gloss"				AS gloss,
						"Brief Gloss"			AS brief_gloss,
						"LN Note"				AS note,
						Categories				AS categorization,
						Examples 				AS curated_examples,
						Level						AS level

			FROM ${table_name}
		`).all()
	).flat() // flattens each of the part of speech results into a single array of all concepts

	console.log('done.')

	return transformed_data
}

function create_tabitha_table(tabitha_db: Database) {
	console.log(`Creating Concepts table in ${tabitha_db.filename}...`)

	tabitha_db.run(`
		CREATE TABLE IF NOT EXISTS Concepts (
			id						INTEGER,
			stem					TEXT,
			sense					TEXT,
			part_of_speech		TEXT,
			occurrences			TEXT,
			gloss					TEXT,
			brief_gloss			TEXT,
			note					TEXT,
			categorization		TEXT,
			curated_examples	TEXT,
			level					INTEGER
		)
	`)

	console.log('done.')
}

function load_data(tabitha_db: Database, transformed_data: TransformedData[]) {
	console.log(`Loading data into Concepts table...`)

	transformed_data.map(async ({id, stem, part_of_speech, occurrences, gloss, brief_gloss, note, categorization, curated_examples, level}) => {
		tabitha_db.run(`
			INSERT INTO Concepts (id, stem, part_of_speech, occurrences, gloss, brief_gloss, note, categorization, curated_examples, level)
			VALUES (?,?,?,?,?,?,?,?,?,?)
		`, [id, stem, part_of_speech, occurrences, gloss, brief_gloss, note, categorization, curated_examples, level])

		await Bun.write(Bun.stdout, '.')
	})

	console.log('done.')
}
