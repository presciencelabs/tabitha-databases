import {
	CREATE_COMPLEX_TERMS_TABLE_SQL,
	extract,
	INSERT_COMPLEX_TERMS_SQL,
	transform,
	type ComplexTerm,
} from './complex_terms'

export default {
	// https://developers.cloudflare.com/workers/runtime-apis/handlers/scheduled/
	async scheduled(event: ScheduledEvent, env: Env) {
		const extracted_rows = await extract()

		if (extracted_rows.length < 1) {
			return console.log('No need to update database.')
		}

		const data = transform(extracted_rows)

		await load(data)

		// https://developers.cloudflare.com/d1/build-databases/query-databases/#await-stmtfirstcolumn
		const num_terms = await env.DB_Ontology.prepare('SELECT COUNT(*) AS count FROM Complex_Terms').first('count')
		console.log(`updated ${num_terms} complex terms in database.`)

		async function load(terms: ComplexTerm[]) {
			// https://developers.cloudflare.com/d1/build-databases/query-databases
			env.DB_Ontology.prepare(CREATE_COMPLEX_TERMS_TABLE_SQL).run()

			const clear_stmt = env.DB_Ontology.prepare('DELETE FROM Complex_Terms')
			const insert_stmt = env.DB_Ontology.prepare(INSERT_COMPLEX_TERMS_SQL)
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
