import { FEATURES } from './semantic_encoding'

/**
 * 
 * @param {number} entity_index 
 * @param {SourceEntity[]} source_entities 
 * @returns {ContextArguments}
 */
export function find_word_context(entity_index, source_entities) {
	const entity = source_entities[entity_index]
	// console.log(`Checking ${entity.label} ${entity.value}-${entity.sense}...`)
	return context_argument_finder[entity.label]?.(entity_index, source_entities) ?? {}
}

/**
 * @type {Record<string, (entity_index: number, source_entities: SourceEntity[]) => ContextArguments>}
 */
const context_argument_finder = {
	Noun: find_noun_context,
	Verb: find_verb_context,
	Adjective: find_adjective_context,
	Adverb: find_adverb_context,
	Adposition: find_adposition_context,
}

/**
 * 
 * @param {number} entity_index 
 * @param {SourceEntity[]} source_entities 
 * @returns {ContextArguments}
 */
function find_noun_context(entity_index, source_entities) {
	const np_index = find_containing_phrase(entity_index, source_entities)
	if (np_index === -1) {
		throw new Error(`Invalid semantic encoding - Noun not in a phrase`)
	}

	const context_arguments = get_outer_context(np_index, source_entities, 'Outer')

	context_arguments['Role'] = context_arguments['Verb']
		? get_feature_value(source_entities[np_index], FEATURES.NP.SEMANTIC_ROLE)
		: 'No Role'

	const adp_index = find_entity_before(
		entity => entity.label === 'Adposition',
		{ skip_phrases: true, break_condition: is_opening_phrase },
	)(entity_index, source_entities)
	if (adp_index !== -1) {
		context_arguments['Adposition'] = format_concept(source_entities[adp_index])
	}

	return context_arguments
}

/**
 * 
 * @param {number} entity_index 
 * @param {SourceEntity[]} source_entities 
 * @returns {ContextArguments}
 */
function find_verb_context(entity_index, source_entities) {
	const clause_index = find_containing_clause(entity_index, source_entities)
	const context_arguments = {
		'Topic NP': get_feature_value(source_entities[clause_index], FEATURES.CLAUSE.TOPIC_NP),
		'Polarity': get_feature_value(source_entities[entity_index], FEATURES.VERB.POLARITY),
	}

	const argument_indexes = find_entities_after(clause_index, source_entities, entity => [
		entity => is_opening_sub_clause(entity) && has_features(entity, FEATURES.CLAUSE.TYPE, ['Propositional Agent', 'Propositional Patient']),
		entity => is_phrase(entity, 'NP') && !has_feature(entity, FEATURES.NP.SEMANTIC_ROLE, 'Oblique'),
		entity => is_phrase(entity, 'AdjP') && has_feature(entity, FEATURES.ADJP.USAGE, 'Predicative'),
	].some(filter => filter(entity)))

	argument_indexes.filter(index => is_phrase(source_entities[index], 'NP'))
		.filter(index => has_features(source_entities[index], FEATURES.NP.SEQUENCE, ['Not in a Sequence', 'First Coordinate']))
		.forEach(index => context_arguments[get_feature_value(source_entities[index], FEATURES.NP.SEMANTIC_ROLE)]
			= format_concept(get_head_word(index, source_entities)))

	argument_indexes.filter(index => is_phrase(source_entities[index], 'AdjP'))
		.filter(index => has_features(source_entities[index], FEATURES.ADJP.SEQUENCE, ['Not in a Sequence', 'First Coordinate']))
		.forEach(index => context_arguments['Predicate Adjective'] = format_concept(get_head_word(index, source_entities)))
			
	argument_indexes.filter(index => is_opening_sub_clause(source_entities[index]))
		.filter(index => has_features(source_entities[index], FEATURES.CLAUSE.SEQUENCE, ['Not in a Sequence', 'First Coordinate']))
		.forEach(index => context_arguments[get_feature_value(source_entities[index], FEATURES.CLAUSE.TYPE)]
			= format_clause(index, source_entities))

	return context_arguments
}

/**
 * 
 * @param {number} entity_index 
 * @param {SourceEntity[]} source_entities 
 * @returns {ContextArguments}
 */
function find_adjective_context(entity_index, source_entities) {
	const adjp_index = find_containing_phrase(entity_index, source_entities)
	if (adjp_index === -1) {
		throw new Error(`Invalid semantic encoding - Adjective not in a phrase`)
	}
	
	const context_arguments = {
		'Degree': get_feature_value(source_entities[entity_index], FEATURES.ADJ.DEGREE),
		...get_outer_context(adjp_index, source_entities, 'Modified'),
	}
	
	const argument_indexes = find_entities_after(adjp_index, source_entities, entity => [
		entity => is_phrase(entity, 'NP'),
		entity => is_opening_sub_clause(entity) && has_feature(entity, FEATURES.CLAUSE.TYPE, 'Attributive Patient'),
	].some(filter => filter(entity)))

	const np_argument_index = argument_indexes.find(index => is_phrase(source_entities[index], 'NP'))
	if (np_argument_index) {
		context_arguments['Patient Noun'] = format_concept(get_head_word(np_argument_index, source_entities))
	}

	const clause_argument_index = argument_indexes.find(index => is_opening_sub_clause(source_entities[index]))
	if (clause_argument_index) {
		context_arguments['Patient Clause'] = format_clause(clause_argument_index, source_entities)
	}

	return context_arguments
}

/**
 * 
 * @param {number} entity_index 
 * @param {SourceEntity[]} source_entities 
 * @returns {ContextArguments}
 */
function find_adverb_context(entity_index, source_entities) {
	const advp_index = find_containing_phrase(entity_index, source_entities)
	return {
		'Degree': get_feature_value(source_entities[entity_index], FEATURES.ADV.DEGREE),
		...get_outer_context(advp_index, source_entities, 'Modified'),
	}
}

/**
 * 
 * @param {number} entity_index 
 * @param {SourceEntity[]} source_entities 
 * @returns {ContextArguments}
 */
function find_adposition_context(entity_index, source_entities) {
	const phrase_index = find_containing_phrase(entity_index, source_entities)
	if (phrase_index === -1) {
		return {}	// no special arguments
	}

	const head_word = get_head_word(phrase_index, source_entities)
	return {
		[head_word.label]: format_concept(head_word),
		...get_outer_context(phrase_index, source_entities, 'Outer'),
	}
}

/**
 * 
 * @param {number} phrase_index 
 * @param {SourceEntity[]} source_entities 
 * @param {string} outer_label 
 */
function get_outer_context(phrase_index, source_entities, outer_label) {
	const outer_phrase_index = find_containing_phrase(phrase_index, source_entities)
	if (outer_phrase_index !== -1) {
		// This is a phrase within another phrase
		const outer_word = get_head_word(outer_phrase_index, source_entities)
		return { [`${outer_label} ${outer_word.label}`]: format_concept(outer_word) }
	}

	const verb_index = find_verb(phrase_index, source_entities)
	if (verb_index !== -1) {
		// this is a main phrase relating to the Verb
		return { 'Verb': format_concept(source_entities[verb_index]) }
	}

	return {}
}

function format_concept(entity) {
	return `${entity.value}-${entity.sense}`
}

/**
 * 
 * @param {number} clause_index 
 * @param {SourceEntity[]} source_entities 
 */
function format_clause(clause_index, source_entities) {
	const verb_index = find_verb(clause_index + 1, source_entities)
	return `[${verb_index !== -1 ? format_concept(source_entities[verb_index]) : ''}]`
}

function is_phrase(entity, label) {
	return entity.label === label
}

function is_opening_sub_clause(entity) {
	return entity.value === '['
}

function is_opening_phrase(entity) {
	return entity.value === '('
}

function is_closing_phrase(entity) {
	return entity.value === ')'
}

function is_closing_sub_clause(entity) {
	return entity.value === ']'
}

function is_opening_any_clause(entity) {
	return ['[', '{'].includes(entity.value)
}

function is_closing_any_clause(entity) {
	return [']', '}'].includes(entity.value)
}

/**
 * 
 * @param {number} index 
 * @param {SourceEntity[]} source_entities 
 * @returns {number}
 */
function find_containing_phrase(index, source_entities) {
	return find_entity_before(is_opening_phrase, { skip_phrases: true, break_condition: is_opening_any_clause })(index, source_entities)
}

/**
 * 
 * @param {number} index 
 * @param {SourceEntity[]} source_entities 
 * @returns {number}
 */
function find_containing_clause(index, source_entities) {
	const clause_index = find_entity_before(is_opening_any_clause, { skip_clauses: true })(index, source_entities)
	if (clause_index === -1) {
		throw new Error('Invalid semantic encoding - no containing clause')
	}
	return clause_index
}

/**
 * 
 * @param {number} phrase_index 
 * @param {SourceEntity[]} source_entities 
 * @returns {number}
 */
function get_head_word(phrase_index, source_entities) {
	const phrase_type = source_entities[phrase_index].label
	const word_type = {
		NP: 'Noun',
		VP: 'Verb',
		AdjP: 'Adjective',
		AdvP: 'Adverb',
	}[phrase_type] ?? ''

	const head_index = find_entity_after(
		entity => entity.label === word_type,
		{ skip_phrases: true, skip_clauses: true, break_condition: is_closing_phrase }
	)(phrase_index, source_entities)

	if (head_index === -1) {
		throw new Error(`Invalid semantic encoding - missing head ${word_type} in ${phrase_type}`)
	}
	return source_entities[head_index]
}

/**
 * Find the only verb within the clause that the index is within.
 * 
 * @param {number} index 
 * @param {SourceEntity[]} source_entities 
 */
function find_verb(index, source_entities) {
	let verb_index = find_entity_before(
		entity => entity.label === 'Verb',
		{ skip_clauses: true, break_condition: is_opening_any_clause },
	)(index, source_entities)

	if (verb_index !== -1) {
		return verb_index
	}

	return find_entity_after(
		entity => entity.label === 'Verb',
		{ skip_clauses: true, break_condition: is_closing_any_clause },
	)(index, source_entities)
}

/**
 * 
 * @param {number} index the index in source_entities of an opening subordinate clause
 * @param {SourceEntity[]} source_entities 
 * @return {number} the index after the corresponding closing clause boundary
 */
function skip_to_clause_end(index, source_entities) {
	return find_entity_after(is_closing_sub_clause, { skip_clauses: true })(index, source_entities) + 1
}

/**
 * 
 * @param {number} index the index in source_entities of a closing subordinate clause
 * @param {SourceEntity[]} source_entities 
 * @return {number} the index before the corresponding opening clause boundary
 */
function skip_to_clause_start(index, source_entities) {
	return find_entity_before(is_opening_sub_clause, { skip_clauses: true })(index, source_entities) - 1
}

/**
 * 
 * @param {number} index the index in source_entities of an opening phrase boundary
 * @param {SourceEntity[]} source_entities 
 * @return {number} the index after the corresponding closing phrase boundary
 */
function skip_to_phrase_end(index, source_entities) {
	return find_entity_after(is_closing_phrase, { skip_phrases: true })(index, source_entities) + 1
}

/**
 * 
 * @param {number} index the index in source_entities of a closing phrase boundary
 * @param {SourceEntity[]} source_entities 
 * @return {number} the index before the corresponding opening phrase boundary
 */
function skip_to_phrase_start(index, source_entities) {
	return find_entity_before(is_opening_phrase, { skip_phrases: true })(index, source_entities) - 1
}

/**
 * 
 * @param {(entity: SourceEntity) => boolean} entity_filter 
 * @param {Object} [param1={}] 
 * @param {boolean} [param1.skip_phrases=false] 
 * @param {boolean} [param1.skip_clauses=false] 
 * @param {(entity: SourceEntity) => boolean} [param1.break_condition=()=>false] 
 * @returns {(start_index: number, source_entities: SourceEntity[]) => number}
 */
function find_entity_before(entity_filter, { skip_phrases=false, skip_clauses=false, break_condition=()=>false }={}) {
	return (start_index, source_entities) => {
		for (let i = start_index - 1; i >= 0;) {
			const entity = source_entities[i]
			if (entity_filter(entity)) {
				return i
			} else if (skip_phrases && is_closing_phrase(entity)) {
				i = skip_to_phrase_start(i, source_entities)
			} else if (skip_clauses && is_closing_sub_clause(entity)) {
				i = skip_to_clause_start(i, source_entities)
			} else if (break_condition(entity)) {
				break
			} else {
				i--
			}
		}
		return -1
	}
}

/**
 * 
 * @param {(entity: SourceEntity) => boolean} entity_filter 
 * @param {Object} [param1={}] 
 * @param {boolean} [param1.skip_phrases=false] 
 * @param {boolean} [param1.skip_clauses=false] 
 * @param {(entity: SourceEntity) => boolean} [param1.break_condition=()=>false] 
 * @returns {(start_index: number, source_entities: SourceEntity[]) => number}
 */
function find_entity_after(entity_filter, { skip_phrases=false, skip_clauses=false, break_condition=()=>false }={}) {
	return (start_index, source_entities) => {
		for (let i = start_index + 1; i < source_entities.length;) {
			const entity = source_entities[i]
			if (entity_filter(entity)) {
				return i
			} else if (skip_phrases && is_opening_phrase(entity)) {
				i = skip_to_phrase_end(i, source_entities)
			} else if (skip_clauses && is_opening_sub_clause(entity)) {
				i = skip_to_clause_end(i, source_entities)
			} else if (break_condition(entity)) {
				break
			} else {
				i++
			}
		}
		return -1
	}
}

/**
 * Finds all the entities that match the given filter, at the same level as the entity at the given index.
 * The matching entities must be either a phrase or a subordinate clause.
 * 
 * @param {number} index
 * @param {SourceEntity[]} source_entities 
 * @param {(entity: SourceEntity) => boolean} entity_filter 
 * @return {number[]} the indexes
 */
function find_entities_after(index, source_entities, entity_filter) {
	const argument_indexes = []

	while (true) {
		const argument_index = find_entity_after(
			entity_filter,
			{ break_condition: entity => [')', ']', '}'].includes(entity.value), skip_phrases: true, skip_clauses: true },
		)(index, source_entities)

		if (argument_index === -1) {
			break
		}

		index = is_opening_phrase(source_entities[argument_index])
			? skip_to_phrase_end(argument_index, source_entities) - 1	// subtract 1 to point to phrase boundary, not the entity after it
			: is_opening_sub_clause(source_entities[argument_index])
				? skip_to_clause_end(argument_index, source_entities) - 1
				: argument_index
		
		argument_indexes.push(argument_index)
	}

	return argument_indexes
}

/**
 * 
 * @param {SourceEntity} entity 
 * @param {Feature} feature 
 */
function get_feature_value(entity, feature) {
	return feature.labels[entity.features[feature.index]]
}

/**
 * 
 * @param {SourceEntity} entity 
 * @param {Feature} feature 
 * @param {string} label 
 * @returns {boolean}
 */
function has_feature(entity, feature, label) {
	return entity.features[feature.index] === feature.letters[label]
}

/**
 * 
 * @param {SourceEntity} entity 
 * @param {Feature} feature 
 * @param {string[]} labels
 * @returns {boolean}
 */
function has_features(entity, feature, labels) {
	return labels.includes(feature.labels[entity.features[feature.index]])
}