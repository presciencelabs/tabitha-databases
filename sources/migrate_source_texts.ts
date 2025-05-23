import Database from 'bun:sqlite'

export function migrate_source_texts(tabitha_sources_db: Database, tbta_sources_from_input: string[]) {
	console.log(`Prepping Sources table in ${tabitha_sources_db.filename}...`)
	tabitha_sources_db.run(`
		CREATE TABLE IF NOT EXISTS Sources (
			'type', -- e.g., Bible, Grammar Introduction, Community Development Texts
			'id_primary', -- for Bible, this would hold the book name, e.g., Genesis
			'id_secondary', -- for Bible, this would hold the chapter, e.g., 1
			'id_tertiary', -- for Bible, this would hold the verse, e.g., 1
			'phase_1_encoding',
			'semantic_encoding',
			'notes'
		)
	`)
	tabitha_sources_db.run(`
		DELETE FROM Sources
	`)
	console.log('done.')

	tbta_sources_from_input.map(tbta_source_from_input => {
		console.log(`Extracting relevant table names from ${tbta_source_from_input}...`)
		const tbta_db = new Database(tbta_source_from_input) // databases/Bible.YYYY-MM-DD.tbta.sqlite
		const tbta_source_name = tbta_source_from_input.match(/\/([^.]+)/)?.[1] // Bible

		// https://bun.sh/docs/api/sqlite#reference
		const tbta_source_tablenames = tbta_db.query<{ name: string }, []>(`
			SELECT name
			FROM sqlite_master
			WHERE type = 'table'
				AND name != 'Version'
		`).all().map(({name}) => name)

		tbta_source_tablenames.map(tbta_table_name => {
			type SourceRow = {
				Source: string
				Reference: string
				Verse: string
				AnalyzedVerse: string
				Notes: string
			}
			const tbta_data_rows_per_table = tbta_db.query<SourceRow, []>(`
				SELECT '${tbta_source_name}' AS Source, Reference, Verse, AnalyzedVerse, Notes
				FROM '${tbta_table_name}'
			`).all()

			console.log()
			console.log(`transforming data from ${tbta_table_name} and inserting into ${tabitha_sources_db.filename}:`)
			const inserted_rows = tbta_data_rows_per_table
				.filter(({Reference}) => !!Reference) // excludes those rows populed with `NULL` (for some reason)
				.map(async tbta_row => {
					const {Source, Reference, Verse, AnalyzedVerse, Notes} = tbta_row

					// transforms something like "Community_Development_Texts" into "Community Development Texts"
					const type = Source.replaceAll('_', ' ')

					// Reference looks like this: "Daniel 3:9" or "1_Chronicles 1:1"
					const [, id_primary, id_secondary, id_tertiary] = /(.*) (\d+):(\d+)/.exec(Reference) ?? [,'', 0, 0]

					const phase_1_encoding = Verse ?? ''
					const semantic_encoding = AnalyzedVerse ?? ''
					const notes = Notes ?? ''

					tabitha_sources_db.run(`
						INSERT INTO Sources
						VALUES (?, ?, ?, ?, ?, ?, ?)
					`, [type, id_primary, id_secondary, id_tertiary, phase_1_encoding, semantic_encoding, notes])

					await Bun.write(Bun.stdout, '.')
			})

			console.log(`${inserted_rows.length} rows inserted.`)
		})
	})
	console.log()
	console.log('done.')
}