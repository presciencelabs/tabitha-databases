// usage: `bun .github/workflows/init.js db_folder args`
//
// | db_folder  | args |
// | ---------- | ---- |
// | ontology   | Ontology.VERSION.YYYY-MM-DD.mdb.sqlite |
// | sources    | Bible.YYYY-MM-DD.mdb.sqlite Community_Development_Texts.YYYY-MM-DD.mdb.sqlite Grammar_Introduction.YYYY-MM-DD.mdb.sqlite Sources.YYYY-MM-DD.tabitha.sqlite |
//

const db_folder	= Bun.argv[2]
const args			= Bun.argv.slice(3)

try {
	const db_name_map = transform(args)

	check_naming_convention(db_name_map)

	check_for_existence(db_name_map.tbta)

	return `
		ABC=123
		DEF=456
		GHI=789
	`
} catch (e) {
	console.error(e)

	process.exit(1)
}

function transform(db_names) {
	return db_names.reduce((map, db_name) => {
		const lookup = {
			'mdb.sqlite': 'tbta',
			'tabitha.sqlite': 'tabitha',
		}

		// extension should either be `mdb.sqlite` or `tabitha.sqlite`
		const extension = db_name.split('.').slice(-2).join('.')
		const type = lookup[extension] || 'other'

		map[type] = map[type] || []
		map[type].push(db_name)

		return map
	}, {})
}

function check_naming_convention(mapper) {
	if (mapper.other?.length > 0) {
		throw `Found ${mapper.other.length} invalid extension(s): ${mapper.other.join(', ')}`
	}

	const db_names = Object.entries(mapper).map(([, db_names]) => db_names).flat()

	for (const db_name of db_names) {
		// *.YYYY-MM-DD.mdb.sqlite or *.YYYY-MM-DD.tabitha.sqlite
		// TODO: this could be a little stronger by validating the date
		const INCLUDES_DATE = /\.\d{4}-\d{2}-\d{2}\.(mdb|tabitha)\.sqlite$/

		if (!INCLUDES_DATE.test(db_name)) {
			throw `Database name must contain a date stamp, e.g., Bible.1970-01-01.mdb.sqlite: ${db_name}`
		}
	}
}

async function check_for_existence(tbta_db_names) {
	for (const tbta_db_name of tbta_db_names) {
		const LOCATION = `./tbta_dbs_as_sqlite/${tbta_db_name}`

		if (! await Bun.file(LOCATION).exists()) {
			throw `The TBTA database must be available in ${LOCATION}`
		}
	}
}
