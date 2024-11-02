import Database from 'bun:sqlite'

export function migrate_form_names_table(tbta_db: Database, project: string, targets_db: Database) {
	const transformed_data = transform_tbta_data(tbta_db)

	create_tabitha_table(targets_db)

	load_data(targets_db, project, transformed_data)
}

type TransformedData = {
	part_of_speech: string
	name: string
	position: number
}
function transform_tbta_data(tbta_db: Database): TransformedData[] {
	const extracted_data = extract()

	const transformed_data = transform()

	return transformed_data

	type DbRow = {
		part_of_speech: string
		name: string
		FieldName: string
	}
	function extract(): DbRow[] {
		console.log(`Extracting form names from ${tbta_db.filename}...`)

		const sql = `
		  SELECT	SyntacticName as part_of_speech,
					FormName as name,
					FieldName

		  FROM	LexicalFormNames
				INNER JOIN	SyntacticCategories
				ON				SyntacticCategory = SyntacticCategories.ID

		  ORDER BY SyntacticCategory
	  `
		const results = tbta_db.prepare<DbRow, []>(sql).all()

		console.log('done.')

		return results
	}

	function transform(): TransformedData[] {
		console.log(`Transforming data from ${tbta_db.filename}...`)

		const transformed_data = extracted_data.map(({part_of_speech, name, FieldName}) => ({
			part_of_speech,
			name,
			position: Number(FieldName.match(/(\d+)/)?.[1] ?? 0), // FieldName pattern:  "Form Name 1", "Form Name 2", etc.
		}))

		console.log('done.')

		return transformed_data
	}
}

function create_tabitha_table(targets_db: Database) {
	console.log(`Creating Form_Names table in ${targets_db.filename}...`)

	targets_db.run(`
		CREATE TABLE IF NOT EXISTS Form_Names (
			project			TEXT,
			part_of_speech	TEXT,
			name				TEXT,
			position			INTEGER
		)
	`)

	console.log('done.')

	return targets_db
}

function load_data(targets_db: Database, project: string, transformed_data: TransformedData[]) {
	console.log(`Loading data into Form_Names table...`)

	transformed_data.map(async ({part_of_speech, name, position}) => {
		targets_db.run(`
			INSERT INTO Form_Names (project, part_of_speech, name, position)
			VALUES (?, ?, ?, ?)
			`, [project, part_of_speech, name, position])

		await Bun.write(Bun.stdout, '.')
	})

	console.log('done.')
}
