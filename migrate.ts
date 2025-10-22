import { $ } from 'bun'
import Database from 'bun:sqlite'
import wrangler_cfg from './wrangler.jsonc'

if (!Bun.which('sqlite3')) {
	throw new Error('sqlite3 is not installed. Please install it and try again.')
}

if (Bun.argv.length !== 4) {
	throw new Error('Usage: bun migrate.ts "~/Downloads/TBTA 9-25-25.zip" 2025-09-25')
}
const zip = Bun.argv[2] 								// "~/Downloads/TBTA 9-25-25.zip"
const dir = zip.slice(0, zip.lastIndexOf('/')) 	// "~/Downloads/"
const date = Bun.argv[3] 								// 2025-09-25

await stage_tbta_files(`${dir}/${date}`)

const ls_output = await $`ls databases/*.${date}.tbta.sqlite`.text()
const dbs_for_migration = ls_output
	.split('\n')
	.filter(Boolean) // remove empty strings

type DbConfig = {
	key: 'Sources' | 'Ontology' | 'Targets'
	migration_input_args(): string[]
}
const configs: DbConfig[] = [
	{
		key: 'Sources',
		migration_input_args() {
			const bible = dbs_for_migration.find(name => name.includes('Bible') && name.endsWith('.tbta.sqlite'))
			if (!bible) throw new Error(`Bible database not found for ${this.key} migration.`)

			return [bible]
		},
	},
	{
		key: 'Ontology',
		migration_input_args() {
			const ontology = dbs_for_migration.find(name => name.includes('Ontology') && name.endsWith('.tbta.sqlite'))
			if (!ontology) throw new Error(`Ontology database not found for ${this.key} migration.`)

			const sources = dbs_for_migration.find(name => name.includes('Sources') && name.endsWith('.tabitha.sqlite'))
			if (!sources) throw new Error(`Sources database not found for ${this.key} migration.`)

			return [ontology, sources]
		},
	},
	{
		key: 'Targets',
		migration_input_args() {
			const english = dbs_for_migration.find(name => name.includes('English') && name.endsWith('.tbta.sqlite'))
			if (!english) throw new Error(`English database not found for ${this.key} migration.`)

			return [english]
		},
	},
]

for (const cfg of configs) {
	console.log(`Migrating ${cfg.key} database...`)
	const dest_file = derive_dest_file(cfg.key)
	await $`bun ${cfg.key.toLowerCase()}/migrate.ts ${cfg.migration_input_args()} ${dest_file}`

	dbs_for_migration.push(dest_file)

	console.log(`Creating dump of ${cfg.key} database...`)
	await $`sqlite3 ${dest_file} .dump | grep -Ev "^PRAGMA|^BEGIN TRANSACTION|^COMMIT" > ${dest_file}.sql`

	console.log(`Creating new D1 database for ${cfg.key}...`)
	const d1_db_name = dest_file.match(/([^/]+)\.tabitha\.sqlite$/)?.[1] // => Sources.2025-10-22 or Ontology.9493.2025-10-22
	const cmd_output_new_db = await $`bun wrangler d1 create ${d1_db_name}`.text()

	console.log(`Updating wrangler.jsonc with new ${cfg.key} database info...`)
	const new_db_info = extract_new_db_info(cmd_output_new_db)
	await update_deployment_config(new_db_info, `DB_${cfg.key}`)

	console.log(`Deploying new ${cfg.key} data to D1...`)
	await $`bun wrangler d1 execute ${d1_db_name} --file ${dest_file}.sql --remote`.quiet()
}

async function stage_tbta_files(working_dir: string) {
	await $`mkdir -p ${working_dir} && unzip -o ${zip} -d ${working_dir}`

	const unzipped_db_names = await $`ls ${working_dir}/*.sqlite`.text()

	await Promise.all(stage(unzipped_db_names))

	function stage(db_names: string): Promise<$.ShellOutput>[] {
		return db_names
			.split('\n')
			.filter(Boolean)
			.map(db_name => db_name.match(/([^/]+)\.sqlite$/)?.[1] ?? '') // ~/Downloads/2025-09-25/Bible.sqlite => Bible
			.filter(Boolean) // remove empty strings
			.map(normalize_name)
			.map(async ({ src, dest }) => await $`mv ${src} ${dest}`)
	}

	function normalize_name(name: string) {
		const src = `${working_dir}/${name}.sqlite`

		let dest = `./databases/${name}.${date}.tbta.sqlite`
		if (name === 'Ontology') {
			dest = derive_ontology_name()
		}

		return { src, dest }

		function derive_ontology_name() {
			const ontology = new Database(src, { readonly: true })

			const { Version } = ontology.query('SELECT Version FROM OntologyVersion').get() as { Version: string }

			const version = Version.split('.').at(-1) // 3.0.9493 => 9493

			return `./databases/Ontology.${version}.${date}.tbta.sqlite`
		}
	}
}

function derive_dest_file(key: DbConfig['key']) {
	const tbta_file = dbs_for_migration.find(name => name.includes(key) && name.endsWith('.tbta.sqlite'))

	if (tbta_file) return tbta_file.replace('.tbta.', '.tabitha.')

	return `./databases/${key}.${date}.tabitha.sqlite`
}

type D1_META = {
	binding: string
	database_name: string
	database_id: string
}
function extract_new_db_info(output: string): D1_META {
	// example output:
	//
	// ⛅️ wrangler 4.42.0
	// ───────────────────
	// ✅ Successfully created DB 'Sources.2025-10-05-f' in region ENAM
	// Created your new D1 database.

	// To access your new D1 Database in your Worker, add the following snippet to your configuration file:
	// {
	// 	"d1_databases": [
	// 		{
	// 			"binding": "Sources2025_10_05_f",
	// 			"database_name": "Sources.2025-10-05-f",
	// 			"database_id": "90ccd9c5-37ee-4b83-9fca-3811ce0ca010"
	// 		}
	// 	]
	// }
	// ? Would you like Wrangler to add it on your behalf ?
	// 🤖 Using fallback value in non - interactive context: no
	const JSON_OBJECT = /^{.*^}/ms

	return JSON.parse(output.match(JSON_OBJECT)?.[0]!).d1_databases[0]
}

function update_deployment_config(new_db_info: D1_META, binding: string) {
	const index = wrangler_cfg.d1_databases.findIndex((db: D1_META) => db.binding === binding)
	wrangler_cfg.d1_databases[index].database_name = new_db_info.database_name
	wrangler_cfg.d1_databases[index].database_id = new_db_info.database_id

	return Bun.write('./wrangler.jsonc', JSON.stringify(wrangler_cfg, null, 3))
}
