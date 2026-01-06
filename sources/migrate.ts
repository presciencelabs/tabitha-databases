import Database from 'bun:sqlite'
import { migrate_source_features } from './migrate_source_features'
import { migrate_source_texts } from './migrate_source_texts'

// usage: `bun sources/migrate.ts databases/Bible.YYYY-MM-DD.tbta.sqlite databases/Community_Development_Texts.YYYY-MM-DD.tbta.sqlite databases/Grammar_Introduction.YYYY-MM-DD.tbta.sqlite databases/Sources.YYYY-MM-DD.tabitha.sqlite`
const tbta_sources_from_input = Bun.argv.slice(2, -1) // individual database names representing all of the sources
const tabitha_db_name 			= Bun.argv.at(-1) 		// the final database, i.e., last argument

const tabitha_sources_db = new Database(tabitha_db_name)

// drastic perf improvement: https://www.sqlite.org/pragma.html#pragma_journal_mode
tabitha_sources_db.run('PRAGMA journal_mode = WAL')

migrate_source_texts(tabitha_sources_db, tbta_sources_from_input)

const date = tabitha_db_name?.match(/(\d{4}-\d{2}-\d{2})\.tabitha\.sqlite$/)?.[1]
const tbta_sample_db = new Database(`databases/Sample.${date}.tbta.sqlite`)
migrate_source_features(tbta_sample_db, tabitha_sources_db)

console.log(`Optimizing ${tabitha_db_name}...`)
tabitha_sources_db.run(`VACUUM`)
console.log('done.')
