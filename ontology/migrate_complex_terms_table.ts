import type { Database } from 'bun:sqlite'
import {
	type ComplexTerm,
	CREATE_COMPLEX_TERMS_TABLE_SQL,
	extract,
	INSERT_COMPLEX_TERMS_SQL,
	transform
} from './complex_terms'

export async function migrate_complex_terms_table(tabitha_db: Database) {
	const extracted_rows = await extract()

	if (extracted_rows.length < 1) {
		return console.log('No need to update database.')
	}

	const transformed_data = transform(extracted_rows)

	create_tabitha_table(tabitha_db)

	load_data(tabitha_db, transformed_data)
}

function create_tabitha_table(tabitha_db: Database) {
	console.log(`Creating Complex_Terms table in ${tabitha_db.filename}...`)

	tabitha_db.run(CREATE_COMPLEX_TERMS_TABLE_SQL)

	tabitha_db.run('DELETE FROM Complex_Terms')

	console.log('done.')
}

function load_data(tabitha_db: Database, terms: ComplexTerm[]) {
	console.log(`Loading data into Complex_Terms table...`)

	terms.map(async ({ stem, sense, part_of_speech, structure, pairing, explication, ontology_status, level, notes }: ComplexTerm) => {
		tabitha_db.run(INSERT_COMPLEX_TERMS_SQL, [stem, sense, part_of_speech, structure, pairing, explication, ontology_status, level, notes])

		await Bun.write(Bun.stdout, '.')
	})

	console.log('done.')
}
