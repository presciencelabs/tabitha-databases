import type { Database } from 'bun:sqlite'

export async function migrate_complex_terms_table(tabitha_db: Database) {
	const extracted_rows = await extract()

	if (extracted_rows.length < 1) {
		return console.log('No need to update database.')
	}

	const transformed_data = transform(extracted_rows)

	create_tabitha_table(tabitha_db)

	load_data(tabitha_db, transformed_data)
}

export async function extract() {
	console.log('fetching latest how-to data')

	const response = await fetch('https://docs.google.com/spreadsheets/d/16_U4MqhwHNd9fR9Ai5ZeAI4AzBFGEAi3KhNyMQbEHlM/export?format=tsv&gid=0')

	const raw_data = await response.text()

	// skip first three rows (headers)
	const [,,, ...rows] = raw_data.split(/\r?\n/)

	console.log(`received ${rows.length} rows from spreadsheet`)

	return rows
}

type TabSeparatedValues = string
type ComplexTerm = {
	stem: string
	sense: string
	part_of_speech: string
	structure: string
	pairing: string
	explication: string
	ontology_status: string
}
export function transform(rows: TabSeparatedValues[]): ComplexTerm[] {
	return rows.map((row: TabSeparatedValues) => {
		const [term, part_of_speech, structure, pairing, explication, ontology_status] = row.split('\t')
		const match = (term ?? '').trim().match(/^(.*)-([A-Z])$/)
		const [stem, sense] = match ? [match[1], match[2]] : [term, '']

		return {
			stem,
			sense,
			part_of_speech: capitalize(part_of_speech),
			structure,
			pairing,
			explication,
			ontology_status,
		}
	})

	function capitalize(text: string) {
		const REGEX_FIRST_CHARACTER = /^./

		return (text ?? '')
			.trim()
			.toLowerCase()
			.replace(REGEX_FIRST_CHARACTER, c => c.toUpperCase())
	}
}

function create_tabitha_table(tabitha_db: Database) {
	console.log(`Creating Complex_Terms table in ${tabitha_db.filename}...`)

	tabitha_db.run(`
		CREATE TABLE IF NOT EXISTS Complex_Terms (
			'stem' 				TEXT,
			'sense'				TEXT,
			'part_of_speech' 	TEXT,
			'structure'		 	TEXT,
			'pairing' 			TEXT,
			'explication' 		TEXT,
			'ontology_status'	TEXT,
		)
	`)

	tabitha_db.run('DELETE FROM Complex_Terms')

	console.log('done.')
}

function load_data(tabitha_db: Database, terms: ComplexTerm[]) {
	console.log(`Loading data into Complex_Terms table...`)

	terms.map(async ({stem, sense, part_of_speech, structure, pairing, explication, ontology_status}: ComplexTerm) => {
		tabitha_db.run(`
			INSERT INTO Complex_Terms (stem, sense, part_of_speech, structure, pairing, explication, ontology_status)
			VALUES (?,?,?,?,?,?,?)
		`, [stem, sense, part_of_speech, structure, pairing, explication, ontology_status])

		await Bun.write(Bun.stdout, '.')
	})

	console.log('done.')
}
