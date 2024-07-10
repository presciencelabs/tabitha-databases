export function summarize_migration(tbta_db, tabitha_db) {
	summarize_concepts(tbta_db, tabitha_db)
	summarize_version(tbta_db, tabitha_db)
	summarize_senses(tabitha_db)
	summarize_complex_terms(tabitha_db)
}

function summarize_concepts(tbta_db, tabitha_db) {
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
		const {count: tbta_count} = tbta_db.query(`
			SELECT count(ID) AS count
			FROM ${table_name}
		`).get()

		const {count: tabitha_count} = tabitha_db.query(`
			SELECT count(id) AS count
			FROM Concepts
			WHERE part_of_speech = '${part_of_speech}'
		`).get()

		console.log(`${table_name}: ${tbta_count} -> ${tabitha_count}`)
	}
}

function summarize_version(tbta_db, tabitha_db) {
	console.log('======= Version =======')

	const {Version} = tbta_db.query(`
		SELECT Version
		FROM OntologyVersion
	`).get()

	const {version} = tabitha_db.query(`
		SELECT version
		FROM Version
	`).get()

	console.log(`${Version} -> ${version}`)
}

function summarize_senses(tabitha_db) {
	console.log('======= Senses =======')

	const results = tabitha_db.query(`
		SELECT stem, part_of_speech, sense
		FROM Concepts
		WHERE stem in ('be', 'love')
		ORDER BY stem, part_of_speech
	`).all()

	console.table(results)
}

function summarize_complex_terms(tabitha_db) {
	console.log('======= Complex Terms =======')

	const {count} = tabitha_db.query(`
		SELECT count(*) AS count
		FROM Complex_Terms
	`).get()

	console.log(`Number of complex terms: ${count}`)
}