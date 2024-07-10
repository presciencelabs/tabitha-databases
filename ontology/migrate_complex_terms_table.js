export async function migrate_complex_terms_table(tabitha_db) {
	const extracted_rows = await extract()

	if (extracted_rows.length < 1) {
		return console.log('No need to update database.')
	}

	const transformed_data = transform(extracted_rows)

	create_tabitha_table(tabitha_db)

	load_data(tabitha_db, transformed_data)
}

/** @returns {Promise<string[]>} */
export async function extract() {
	console.log('fetching latest how-to data')

	const response = await fetch('https://docs.google.com/spreadsheets/d/16_U4MqhwHNd9fR9Ai5ZeAI4AzBFGEAi3KhNyMQbEHlM/export?format=tsv&gid=0')

	/** @type {string} */
	const raw_data = await response.text()

	// skip first two rows (headers)
	/** @type {string[]} */
	const [,, ...rows] = raw_data.split(/\r?\n/)

	console.log(`received ${rows.length} rows from spreadsheet`)

	return rows
}

/**
 * @typedef {string} TabSeparatedValues
 * @param {TabSeparatedValues[]} rows
 *
 * @typedef {Object} ComplexTerm
 * @property {string} term
 * @property {string} part_of_speech
 * @property {string} structure
 * @property {string} pairing
 * @property {string} explication
 *
 * @return {ComplexTerm[]}
 */
export function transform(rows) {
	return rows.map(row => {
		const [term, part_of_speech, structure, pairing, explication,] = row.split('\t')

		return {
			term,
			part_of_speech,
			structure,
			pairing,
			explication,
		}
	})
}

/** @param {import('bun:sqlite').Database} tabitha_db */
function create_tabitha_table(tabitha_db) {
	console.log(`Creating Complex_Terms table in ${tabitha_db.filename}...`)

	tabitha_db.query(`
		CREATE TABLE IF NOT EXISTS Complex_Terms (
			term				TEXT,
			part_of_speech	TEXT,
			structure		TEXT,
			pairing			TEXT,
			explication		TEXT
		)
	`).run()

	tabitha_db.query('DELETE FROM Complex_Terms').run()

	console.log('done.')
}

/**
 * @param {import('bun:sqlite').Database} tabitha_db
 * @param {ComplexTerm[]} terms
 * @returns {(terms: ComplexTerm[]) => Promise<void>}
 */
function load_data(tabitha_db, terms) {
	console.log(`Loading data into Complex_Terms table...`)

	terms.map(async ({term, part_of_speech, structure, pairing, explication}) => {
		tabitha_db.query(`
			INSERT INTO Complex_Terms (term, part_of_speech, structure, pairing, explication)
			VALUES (?,?,?,?,?)
		`).run(term, part_of_speech, structure, pairing, explication)

		await Bun.write(Bun.stdout, '.')
	})

	console.log('done.')
}
