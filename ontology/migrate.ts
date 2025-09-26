import Database from 'bun:sqlite'
import { load_examples } from './exhaustive_examples/load'
import { migrate_complex_terms_table } from './migrate_complex_terms_table'
import { migrate_concepts_table } from './migrate_concepts_table'
import { migrate_senses } from './migrate_senses'
import { migrate_version_table } from './migrate_version_table'
import { summarize_migration } from './summarize_migration'

// usage: `bun ontology/migrate.ts databases/Ontology.VERSION.YYYY-MM-DD.tbta.sqlite databases/Sources.YYYY-MM-DD.tabitha.sqlite databases/Ontology.VERSION.YYYY-MM-DD.tabitha.sqlite`
const tbta_db_name 		= Bun.argv[2]	// databases/Ontology.VERSION.YYYY-MM-DD.tbta.sqlite
const tabitha_db_name 	= Bun.argv[4]	// databases/Ontology.VERSION.YYYY-MM-DD.tabitha.sqlite

const tbta_db = new Database(tbta_db_name)
const tabitha_db = new Database(tabitha_db_name)

// drastic perf improvement: https://www.sqlite.org/pragma.html#pragma_journal_mode
tabitha_db.run('PRAGMA journal_mode = WAL')

migrate_concepts_table(tbta_db, tabitha_db)
migrate_version_table(tbta_db, tabitha_db)
import_legacy_tables(tbta_db, tabitha_db)
migrate_senses(tabitha_db)
await migrate_complex_terms_table(tabitha_db)

const sources_db_name = Bun.argv[3]	// databases/Sources.YYYY-MM-DD.tabitha.sqlite
const sources_db = new Database(sources_db_name)
await load_examples(tabitha_db, sources_db)

console.log(`Optimizing ${tabitha_db_name}...`)
tabitha_db.run(`VACUUM`)
console.log('done.')

console.log(`Migration summary:`)
summarize_migration(tbta_db, tabitha_db)

function import_legacy_tables(tbta_db: Database, tabitha_db: Database) {
	console.log(`Importing legacy tables from ${tbta_db.filename}...`)

	const legacy_tables = [
		'DifferencesEnglishBible',
		'DifferencesMultipleTexts',
		'Features_Source',
		'General_Notes',
		'Properties',
		'Rules_ComplexConcepts',
		'Rules_DeleteAmbiguousPOSTags',
		'Rules_FeatureSetting',
		'Rules_FindReplace',
		'Rules_Groups',
		'Rules_PhraseStructure',
		'Rules_SourceAnalyzing',
		'Rules_Transfer',
		'Sorting_Sequence',
	]

	tabitha_db.run(`ATTACH DATABASE '${tbta_db.filename}' AS tbta;`)

	legacy_tables.map(async table_name => {
		tabitha_db.run(`
			CREATE TABLE IF NOT EXISTS ${table_name} AS
			SELECT * FROM tbta.${table_name}
		`)

		await Bun.write(Bun.stdout, `${table_name}, `)
	})

	tabitha_db.run(`DETACH DATABASE tbta;`)

	console.log('done.')
}
