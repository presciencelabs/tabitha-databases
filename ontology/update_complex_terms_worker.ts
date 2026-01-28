import { extract, transform } from './migrate_complex_terms_table'

export default {
	// https://developers.cloudflare.com/workers/runtime-apis/handlers/scheduled/
	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
		const extracted_rows = await extract()

		if (extracted_rows.length < 1) {
			return console.log('No need to update database.')
		}

		const data = transform(extracted_rows)

		await load(data)

		// https://developers.cloudflare.com/d1/build-databases/query-databases/#await-stmtfirstcolumn
		const num_terms = await env.DB_Ontology.prepare('SELECT COUNT(*) AS count FROM Complex_Terms').first('count')
		console.log(`updated ${num_terms} complex terms in database.`)

		async function load(terms: ReturnType<typeof transform>) {
			// https://developers.cloudflare.com/d1/build-databases/query-databases
			env.DB_Ontology.prepare(`
				CREATE TABLE IF NOT EXISTS Complex_Terms (
					'stem' 				TEXT,
					'sense'				TEXT,
					'part_of_speech' 	TEXT,
					'structure'		 	TEXT,
					'pairing' 			TEXT,
					'explication' 		TEXT,
					'ontology_status'	TEXT,
					'level'				NUMBER,
					'notes'				TEXT
				)
			`).run()

			const clear_stmt = env.DB_Ontology.prepare('DELETE FROM Complex_Terms')
			const insert_stmt = env.DB_Ontology.prepare('INSERT INTO Complex_Terms VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
			const insert_stmts = terms.map(({ stem, sense, part_of_speech, structure, pairing, explication, ontology_status, level, notes }) =>
				insert_stmt.bind(stem, sense, part_of_speech, structure, pairing, explication, ontology_status, level, notes)
			)

			console.log('updating table with latest data')

			// https://developers.cloudflare.com/d1/build-databases/query-databases/#batch-statements
			await env.DB_Ontology.batch([
				clear_stmt,
				...insert_stmts,
			])

			console.log('done!')
		}
	}
}
