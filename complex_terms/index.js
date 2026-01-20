import { extract, transform } from '../ontology/migrate_complex_terms_table'

export default {
	// https://developers.cloudflare.com/workers/runtime-apis/handlers/scheduled/
	/** @param {import('@cloudflare/workers-types').D1Database} db */
	async scheduled(event, {DB_Ontology: db}) {
		const extracted_rows = await extract()

		if (extracted_rows.length < 1) {
			return console.log('No need to update database.')
		}

		const data = transform(extracted_rows)

		await load(data)

		// https://developers.cloudflare.com/d1/build-databases/query-databases/#await-stmtfirstcolumn
		const num_terms = await db.prepare('SELECT COUNT(*) AS count FROM Complex_Terms').first('count')
		console.log(`updated ${num_terms} complex terms in database.`)

		/**
		 * @returns {(terms: ComplexTerm[]) => Promise<void>}
		 */
		async function load(terms) {
			// https://developers.cloudflare.com/d1/build-databases/query-databases
			db.prepare(`
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

			const clear_stmt = db.prepare('DELETE FROM Complex_Terms')
			const insert_stmt = db.prepare('INSERT INTO Complex_Terms VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
			const insert_stmts = terms.map(({ stem, sense, part_of_speech, structure, pairing, explication, ontology_status, level, notes }) =>
				insert_stmt.bind(stem, sense, part_of_speech, structure, pairing, explication, ontology_status, level, notes)
			)

			console.log('updating table with latest data')

			// https://developers.cloudflare.com/d1/build-databases/query-databases/#batch-statements
			await db.batch([
				clear_stmt,
				...insert_stmts,
			])

			console.log('done!')
		}
	}
}
