import Database from 'bun:sqlite'

type CommaSeparatedValues = string

type VerseRange = {
	type: string
	id_primary: string
	id_secondary: string
	id_tertiary_start: number|null
	id_tertiary_end: number|null
}

type VerseStatusRecord = {
	range: VerseRange
	status: SourceStatus
}

type InputStatus = 'Not Started' | 'STACK'
	| 'Drafter [HE1]' | 'First Review' | 'Second Review' | 'Checker [HE2>EBT]'
	| 'Zoho > ParaText' | 'Consultant' | 'Holding' | 'Phase 2'
	| 'Phase 3 (POLISHING)' | 'Polish 2nd Language' | 'Completed This Period' | 'Complete' | 'Previously Complete'

type SourceStatus = 'Not Started' | 'Initial Analysis in Progress' | 'Initial Analysis Complete' | 'Final Review in Progress' | 'Ready to Translate'

const status_mapping: Record<InputStatus, SourceStatus> = {
	'Not Started': 'Not Started',
	'STACK': 'Not Started',
	'Drafter [HE1]': 'Initial Analysis in Progress',
	'First Review': 'Initial Analysis in Progress',
	'Second Review': 'Initial Analysis in Progress',
	'Checker [HE2>EBT]': 'Initial Analysis in Progress',
	'Zoho > ParaText': 'Initial Analysis in Progress',
	'Consultant': 'Initial Analysis in Progress',
	'Holding': 'Initial Analysis Complete',
	'Phase 2': 'Initial Analysis Complete',
	'Completed This Period': 'Initial Analysis Complete',
	'Phase 3 (POLISHING)': 'Final Review in Progress',
	'Polish 2nd Language': 'Ready to Translate',
	'Complete': 'Ready to Translate',
	'Previously Complete': 'Ready to Translate'
}

export async function migrate_source_status(sources_db: Database, csv_dir: string, date: string): Promise<void> {
	const word_forms = await extract(csv_dir, date)

	await load_data(word_forms, sources_db)
}

/**
 * Parses a Bible verse reference string into a VerseRange object.
 * Examples of accepted formats:
 *   "John 3"
 *   "Genesis 1:1-10"
 *   "Jude 1-8"
 */
function parse_verse_range(input: string): VerseRange {
	const regex = /^([\dA-Za-z\s]+?)\s*(\d*):?\s*(?:(\d+)-(\d+))?$/
	const match = input.trim().match(regex)

	if (!match) {
		return {
			type: 'Bible',
			id_primary: input,
			id_secondary: '',
			id_tertiary_start: null,
			id_tertiary_end: null,
		}
	}

	const [, id_primary, id_secondary, id_tertiary_start, id_tertiary_end] = match

	return {
		type: 'Bible',
		id_primary: id_primary.trim(),
		id_secondary: id_secondary || '1',		// books like Jude only have one chapter, so default to "1" if no chapter is specified
		id_tertiary_start: id_tertiary_start ? parseInt(id_tertiary_start) : null,
		id_tertiary_end: id_tertiary_end ? parseInt(id_tertiary_end) : null,
	}
}

async function extract(csv_dir: string, date: string): Promise<VerseStatusRecord[]> {
	console.log(`Getting verse statuses from the CSV files...`)

	const filenames = [`OT_verse_status_${date}.csv`, `NT_verse_status_${date}.csv`]

	const csv_contents_by_file = (await Promise.all(filenames.map(filename => Bun.file(`${csv_dir}/${filename}`).text())))
	const normalized_data = csv_contents_by_file.map(normalize).flat()

	return normalized_data

	function normalize(csv_text: string): VerseStatusRecord[] {
		return csv_text.split(/\r?\n/)
			.slice(1)		// skip the header row
			.filter(line => line !== '')
			.map(transform)

		function transform(row: CommaSeparatedValues): VerseStatusRecord {
			const [csv_status, verse_range] = row.split(',')
			const range = parse_verse_range(verse_range ?? '')
			const status = status_mapping[csv_status as InputStatus] ?? 'Not Started'
			return { range, status }
		}
	}
}

async function load_data(verse_statuses: VerseStatusRecord[], sources_db: Database): Promise<void> {
	console.log(`Loading verse statuses into Sources table...`)

	for (const { range, status } of verse_statuses) {
		const { type, id_primary, id_secondary, id_tertiary_start, id_tertiary_end } = range

		if (id_tertiary_start && id_tertiary_end) {
			sources_db.run(`
				UPDATE Sources
				SET status = ?
				WHERE type = ?
					AND id_primary = ?
					AND id_secondary = ?
					AND CAST(id_tertiary AS INTEGER) BETWEEN ? AND ? 
			`, [status, type, id_primary, id_secondary, id_tertiary_start, id_tertiary_end])

		} else {
			sources_db.run(`
				UPDATE Sources
				SET status = ?
				WHERE type = ?
					AND id_primary = ?
					AND id_secondary = ?
			`, [status, type, id_primary, id_secondary])
		}

		await Bun.write(Bun.stdout, '.')
	}

	console.log('done.')
}