import Database from 'bun:sqlite'

export function migrate_senses(tabitha_db: Database) {
	// https://bun.sh/docs/api/sqlite#reference
	const concepts = tabitha_db.query<Concept, []>(`
		SELECT	id,
					stem,
					part_of_speech

		FROM Concepts

		ORDER BY stem, part_of_speech, id
	`).all()

	const sensed_concepts = derive_senses(concepts)

	console.log('adding senses to db')

	sensed_concepts.map(async ({id, stem, part_of_speech, sense}) => {
		tabitha_db.run(`
			UPDATE Concepts
			SET sense = ?
			WHERE id = ?
				AND stem = ?
				AND part_of_speech = ?
		`, [sense, id ?? -1, stem, part_of_speech])

		await Bun.write(Bun.stdout, '.')
	})

	console.log('done.')
}

function derive_senses(concepts: Concept[]): Concept[] {
	const sensed_concepts: Concept[] = []

	type Key = string // Stem:PartOfSpeech
	type Sense = string // a single character that starts with 'A'
	type SenseTracker = Map<Key, Sense>

	const sense_tracker: SenseTracker = new Map()

	for (const concept of concepts) {
		const {stem, part_of_speech} = concept
		const key = `${stem}:${part_of_speech}`
		const sense = sense_tracker.get(key) || 'A'

		sensed_concepts.push({
			...concept,
			sense,
		})

		sense_tracker.set(key, next(sense))
	}

	return sensed_concepts

	function next(sense: Sense): Sense {
		return String.fromCharCode(sense.charCodeAt(0) + 1)
	}
}
