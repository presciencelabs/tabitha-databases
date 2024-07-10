export function migrate_senses(tabitha_db) {
	// https://bun.sh/docs/api/sqlite#reference
	const concepts = tabitha_db.query(`
		SELECT	id,
					stem,
					part_of_speech

		FROM Concepts

		ORDER BY stem, part_of_speech, id
	`).all()

	const sensed_concepts = derive_senses(concepts)

	console.log('adding senses to db')

	sensed_concepts.map(async ({id, stem, part_of_speech, sense}) => {
		tabitha_db.query(`
			UPDATE Concepts
			SET sense = ?
			WHERE id = ?
				AND stem = ?
				AND part_of_speech = ?
		`).run(sense, id, stem, part_of_speech)

		await Bun.write(Bun.stdout, '.')
	})

	console.log('done.')
}

function derive_senses(concepts) {
	const sensed_concepts = []
	const sense_tracker = new Map()

	for (const concept of concepts) {
		const {stem, part_of_speech} = concept
		const key = `${stem}:${part_of_speech}`
		const sense = sense_tracker.get(key) || 'A'

		sensed_concepts.push({
			...concept,
			sense,
		})

		sense_tracker.set(key, next_sense(sense))
	}

	return sensed_concepts

	/**
	 * @param {string} sense - a single character that started with 'A'
	 *
	 * @returns {string} - the next character in the alphabet
	 */
	function next_sense(sense) {
		return String.fromCharCode(sense.charCodeAt(0) + 1)
	}
}
