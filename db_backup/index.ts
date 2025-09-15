import { $ } from 'bun'
import { Database } from 'bun:sqlite'

type DbInfo = {
	uuid: string
	name: string
	created_at: string
	version: string
	num_tables: string
	file_size: string
	[key: string]: string
}

await $`wrangler whoami --cwd db_backup`

// get latest Ontology via wrangler
// const db_name = await get_latest_database_name('Ontology')

// get dump (https://developers.cloudflare.com/workers/wrangler/commands/#d1-export)
// const dump_filename = `${db_name}.tabitha.sql`
// await $`wrangler d1 export ${db_name} --output ${dump_filename} --remote`

// // create db from dump (https://bun.com/docs/api/sqlite)
// console.log(`creating db from dump...`)
// const db_from_dump = await create_db(dump_filename)

// // upload db to R2 (https://bun.com/docs/api/s3)
// console.log(`uploading ${db_from_dump.filename} to R2...`)
// await $`wrangler r2 object put db-backups/${db_from_dump.filename} --file ${db_from_dump.filename} --remote`


async function get_latest_database_name(name: string): Promise<string> {
	const output = await $`${WRANGLER_CMD} d1 list`.text()

	const relevant_lines = output.split('\n').filter(line => line.startsWith('│'))
	if (relevant_lines.length < 2) {
		throw 'No database table data found in wrangler output.'
	}

	const headers = relevant_lines[0].split('│').map(h => h.trim()).filter(Boolean)
	const data_lines = relevant_lines.slice(1)

	const databases: DbInfo[] = data_lines.map(line => {
		const values = line.split('│').map(v => v.trim()).filter(Boolean)

		return headers.reduce((database, header: keyof DbInfo, index) => {
			database[header] = values[index]
			return database
		}, {} as DbInfo)
	})

	const filtered_databases = databases.filter(db => db.name.startsWith(name))
	const sorted_descending = filtered_databases.sort((a, b) => b.created_at.localeCompare(a.created_at))
	// const latest = sorted_descending[0]
	const latest = sorted_descending[2] // TODO: remove after testing

	return latest.name
}

async function create_db(sql_filename: string): Promise<Database> {
	const db = new Database(sql_filename.replace('.sql', '.sqlite'))

	const sql = await Bun.file(sql_filename).text()
	const statements = sql.split(/;$/gm).filter(s => s.trim() !== '')

	console.log(`Running ${statements.length} statements in ${db.filename}`)

	db.run('PRAGMA journal_mode = WAL;')
	db.run('BEGIN TRANSACTION;')
	for (const statement of statements) {
		db.run(statement)
	}
	db.run('COMMIT;')

	return db
}
