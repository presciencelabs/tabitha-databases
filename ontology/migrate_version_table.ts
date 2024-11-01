import Database from 'bun:sqlite'

type VersionNumber = string

export function migrate_version_table(tbta_db: Database, tabitha_db: Database) {
	const transformed_data: VersionNumber = transform_tbta_data(tbta_db)

	create_tabitha_table(tabitha_db)

	load_data(tabitha_db, transformed_data)
}

function transform_tbta_data(tbta_db: Database): VersionNumber {
	console.log(`Transforming data from ${tbta_db.filename}...`)

	type DbRow = {
		version: string
	}

	const { version } = tbta_db.query<DbRow, []>(`
		SELECT Version AS version
		FROM OntologyVersion
	`).get() ?? { version: '' }

	console.log('done.')

	return version
}

function create_tabitha_table(tabitha_db: Database) {
	console.log(`Creating Version table in ${tabitha_db.filename}...`)

	tabitha_db.run(`
		CREATE TABLE IF NOT EXISTS Version (
			version TEXT
		)
	`)

	console.log('done.')
}

function load_data(tabitha_db: Database, transformed_data: VersionNumber) {
	console.log(`Loading data into Version table...`)

	tabitha_db.run(`
		INSERT INTO Version (version)
		VALUES (?)
	`, [transformed_data])

	console.log('done.')
}
