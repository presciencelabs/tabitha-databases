// usage: `bun .github/workflows/init.ts tbta_db_name(s) tabitha_db_name`
//
// | tbta_db_name(s)                                                                                                             | tabitha_db_name                            |
// | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
// | Ontology.VERSION.YYYY-MM-DD.tbta.sqlite                                                                                     | Ontology.VERSION.YYYY-MM-DD.tabitha.sqlite |
// | Bible.YYYY-MM-DD.tbta.sqlite Community_Development_Texts.YYYY-MM-DD.tbta.sqlite Grammar_Introduction.YYYY-MM-DD.tbta.sqlite | Sources.YYYY-MM-DD.tabitha.sqlite          |
//

const tbta_db_names		= Bun.argv.slice(2, -1)
const tabitha_db_name	= Bun.argv.at(-1) ?? ''

try {
	check_naming_convention(tbta_db_names, tabitha_db_name)

	check_for_existence(tbta_db_names)

	generate_output_for_github_actions(tabitha_db_name)
} catch (e) {
	console.error(e)

	process.exit(1)
}

function check_naming_convention(tbta_db_names, tabitha_db_name) {
	for (const db_name of [...tbta_db_names, tabitha_db_name]) {
		// *.YYYY-MM-DD.tbta.sqlite or *.YYYY-MM-DD.tabitha.sqlite
		const INCLUDES_DATE_AND_EXTENSION = /\.\d{4}-\d{2}-\d{2}\.(tbta|tabitha)\.sqlite$/

		if (!INCLUDES_DATE_AND_EXTENSION.test(db_name)) {
			throw `Database name must contain a date stamp, e.g., Bible.1970-01-01.tbta.sqlite, and end in either .tbta.sqlite or .tabitha.sqlite: ${db_name}`
		}
	}
}

async function check_for_existence(tbta_db_names) {
	for (const tbta_db_name of tbta_db_names) {
		const LOCATION = `./databases/${tbta_db_name}`

		if (! await Bun.file(LOCATION).exists()) {
			throw `The TBTA database file is missing:  ${LOCATION}`
		}
	}
}

function generate_output_for_github_actions(tabitha_db_name) {
	const deploy = tabitha_db_name.replace('.tabitha.sqlite', '') // Ontology.VERSION.YYYY-MM-DD.tabitha.sqlite -> Ontology.VERSION.YYYY-MM-DD

	console.log(`TABITHA_DB_NAME=${tabitha_db_name}`)
	console.log(`TABITHA_DB_DUMP=${tabitha_db_name}.sql`)
	console.log(`DEPLOY_DB_NAME=${deploy}`)
}
