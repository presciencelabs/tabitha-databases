export function migrate_version_table(tbta_db, tabitha_db) {
	const transformed_data = transform_tbta_data(tbta_db)

	create_tabitha_table(tabitha_db)

	load_data(tabitha_db, transformed_data)
}

/** @param {import('bun:sqlite').Database} tbta_db */
function transform_tbta_data(tbta_db) {
	console.log(`Transforming data from ${tbta_db.filename}...`)

	const {version} = tbta_db.query(`
		SELECT Version AS version
		FROM OntologyVersion
	`).get()

	console.log('done.')

	return version
}

/** @param {import('bun:sqlite').Database} tabitha_db */
function create_tabitha_table(tabitha_db) {
	console.log(`Creating Version table in ${tabitha_db.filename}...`)

	tabitha_db.query(`
		CREATE TABLE IF NOT EXISTS Version (
			version TEXT
		)
	`).run()

	console.log('done.')
}

/** @param {import('bun:sqlite').Database} tabitha_db */
function load_data(tabitha_db, transformed_data) {
	console.log(`Loading data into Version table...`)

	tabitha_db.query(`
		INSERT INTO Version (version)
		VALUES (?)
	`).run(transformed_data)

	console.log('done.')
}
