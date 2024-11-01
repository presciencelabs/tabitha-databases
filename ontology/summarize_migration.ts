import Database from 'bun:sqlite'

export function summarize_migration(tbta_db: Database, tabitha_db: Database) {
	summarize_concepts(tbta_db, tabitha_db)
	summarize_version(tbta_db, tabitha_db)
	summarize_senses(tabitha_db)
	summarize_complex_terms(tabitha_db)
}

type Count = { count: number }

function summarize_concepts(tbta_db: Database, tabitha_db: Database) {
	console.log('======= Concepts =======')

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

	for (const [table_name, part_of_speech] of table_name_part_of_speech_map) {
		const {count: tbta_count} = tbta_db.query<Count, []>(`
			SELECT count(ID) AS count
			FROM ${table_name}
		`).get() ?? { count: 0 }

		const {count: tabitha_count} = tabitha_db.query<Count, []>(`
			SELECT count(id) AS count
			FROM Concepts
			WHERE part_of_speech = '${part_of_speech}'
		`).get() ?? { count: 0 }

		console.log(`${table_name}: ${tbta_count} -> ${tabitha_count}`)
	}
}

function summarize_version(tbta_db: Database, tabitha_db: Database) {
	console.log('======= Version =======')

	type VersionNumber = {
		version?: string
		Version?: string
	}

	const {Version} = tbta_db.query<VersionNumber, []>(`
		SELECT Version
		FROM OntologyVersion
	`).get() ?? { Version: '' }

	const {version} = tabitha_db.query<VersionNumber, []>(`
		SELECT version
		FROM Version
	`).get() ?? { version: '' }

	console.log(`${Version} -> ${version}`)
}

function summarize_senses(tabitha_db: Database) {
	console.log('======= Senses =======')

	const results = tabitha_db.query(`
		SELECT stem, part_of_speech, sense
		FROM Concepts
		WHERE stem in ('be', 'love')
		ORDER BY stem, part_of_speech
	`).all()

	console.table(results)
}

function summarize_complex_terms(tabitha_db: Database) {
	console.log('======= Complex Terms =======')

	const {count} = tabitha_db.query<Count, []>(`
		SELECT count(*) AS count
		FROM Complex_Terms
	`).get() ?? { count: 0 }

	console.log(`Number of complex terms: ${count}`)
}
