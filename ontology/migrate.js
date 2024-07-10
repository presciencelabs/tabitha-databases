import { Database } from 'bun:sqlite'
import { migrate_concepts_table } from './migrate_concepts_table'
import { migrate_version_table } from './migrate_version_table'
import { migrate_senses } from './migrate_senses'
import { migrate_complex_terms_table } from './migrate_complex_terms_table'
import { summarize_migration } from './summarize_migration'

// usage: `bun migrate.js Ontology.VERSION.YYYY-MM-DD.mdb.sqlite Ontology.VERSION.YYYY-MM-DD.tabitha.sqlite`
const tbta_db_name	 = Bun.argv[2]	// Ontology.VERSION.YYYY-MM-DD.mdb.sqlite
const tabitha_db_name = Bun.argv[3]	// Ontology.VERSION.YYYY-MM-DD.tabitha.sqlite

const tbta_db	  = new Database(tbta_db_name)
const tabitha_db = new Database(tabitha_db_name)

// drastic perf improvement: https://www.sqlite.org/pragma.html#pragma_journal_mode
tabitha_db.exec('PRAGMA journal_mode = WAL')

migrate_concepts_table(tbta_db, tabitha_db)
migrate_version_table(tbta_db, tabitha_db)
migrate_senses(tabitha_db)
await migrate_complex_terms_table(tabitha_db)

console.log(`Optimizing ${tabitha_db_name}...`)
tabitha_db.query(`VACUUM`).run()
console.log('done.')

console.log(`Migration summary:`)
summarize_migration(tbta_db, tabitha_db)
