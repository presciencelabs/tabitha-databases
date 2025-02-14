import { FEATURES } from './semantic_encoding'

const context_argument_finder: FinderLookup = {
	Noun: find_noun_context,
	Verb: find_verb_context,
	Adjective: find_adjective_context,
	Adverb: find_adverb_context,
	Adposition: find_adposition_context,
}

export function find_word_context(entity_index: number, source_entities: SourceEntity[]): ContextArguments {
	const entity = source_entities[entity_index]
	return context_argument_finder[entity.label]?.(entity_index, source_entities) ?? {}
}

function find_noun_context(entity_index: number, source_entities: SourceEntity[]): ContextArguments {
	const np_index = find_containing_phrase(entity_index, source_entities)

	if (np_index === -1) {
		throw new Error(`Invalid semantic encoding - Noun not in a phrase`)
	}

	const context_arguments = get_outer_context(np_index, source_entities, 'Outer')

	context_arguments['Role'] = context_arguments['Verb']
		? get_feature_value(source_entities[np_index], FEATURES.NP.SEMANTIC_ROLE)
		: 'No Role'

	const adp_index = find_entity_before(
		(entity: SourceEntity) => entity.label === 'Adposition',
		{ skip_phrases: true, break_condition: is_opening_phrase },
	)(entity_index, source_entities)

	if (adp_index !== -1) {
		context_arguments['Adposition'] = format_concept(source_entities[adp_index])
	}

	return context_arguments
}

function find_verb_context(entity_index: number, source_entities: SourceEntity[]): ContextArguments {
	const arguments_finder = find_arguments([
		{
			filter: (entity: SourceEntity) => is_phrase(entity, 'NP') && !has_feature(entity, FEATURES.NP.SEMANTIC_ROLE, 'Oblique'),
			key: (index: number) => get_feature_value(source_entities[index], FEATURES.NP.SEMANTIC_ROLE),
			value: (index: number) => format_concept(get_head_word(index, source_entities)),
		},
		{
			filter: (entity: SourceEntity) => is_phrase(entity, 'AdjP') && has_feature(entity, FEATURES.ADJP.USAGE, 'Predicative'),
			key: () => 'Predicate Adjective',
			value: (index: number) => format_concept(get_head_word(index, source_entities)),
		},
		{
			filter: (entity: SourceEntity) => is_opening_sub_clause(entity)
				&& has_features(entity, FEATURES.CLAUSE.TYPE, ['Propositional Patient', 'Propositional Agent']),
			key: (index: number) => get_feature_value(source_entities[index], FEATURES.CLAUSE.TYPE),
			value: (index: number) => format_clause(index, source_entities),
		},
	])

	const clause_index = find_containing_clause(entity_index, source_entities)

	return {
		'Topic NP': get_feature_value(source_entities[clause_index], FEATURES.CLAUSE.TOPIC_NP),
		'Polarity': get_feature_value(source_entities[entity_index], FEATURES.VERB.POLARITY),
		...arguments_finder(clause_index, source_entities),
	}
}

function find_adjective_context(entity_index: number, source_entities: SourceEntity[]): ContextArguments {
	const adjp_index = find_containing_phrase(entity_index, source_entities)

	if (adjp_index === -1) {
		throw new Error(`Invalid semantic encoding - Adjective not in a phrase`)
	}

	const arguments_finder = find_arguments([
		{
			filter: (entity: SourceEntity) => is_phrase(entity, 'NP'),
			key: () => 'Patient Noun',
			value: (index: number) => format_concept(get_head_word(index, source_entities)),
		},
		{
			filter: (entity: SourceEntity) => is_opening_sub_clause(entity) && has_feature(entity, FEATURES.CLAUSE.TYPE, 'Attributive Patient'),
			key: () => 'Patient Clause',
			value: (index: number) => format_clause(index, source_entities),
		},
	])

	const outer_context = get_outer_context(adjp_index, source_entities, 'Modified')

	// if predicative, also get the agent NP
	if ('Verb' in outer_context) {
		const agent_np_index = find_entity_before(
			(entity: SourceEntity) => is_phrase(entity, 'NP') && has_feature(entity, FEATURES.NP.SEMANTIC_ROLE, 'Agent'),
			{ skip_clauses: true, break_condition: is_opening_any_clause },
		)(adjp_index, source_entities)

		if (agent_np_index !== -1) {
			outer_context['Agent'] = format_concept(get_head_word(agent_np_index, source_entities))
		}
	}

	return {
		'Degree': get_feature_value(source_entities[entity_index], FEATURES.ADJ.DEGREE),
		'Usage': get_feature_value(source_entities[adjp_index], FEATURES.ADJP.USAGE),
		...outer_context,
		...arguments_finder(adjp_index, source_entities),
	}
}

function find_adverb_context(entity_index: number, source_entities: SourceEntity[]): ContextArguments {
	const advp_index = find_containing_phrase(entity_index, source_entities)

	return {
		'Degree': get_feature_value(source_entities[entity_index], FEATURES.ADV.DEGREE),
		...get_outer_context(advp_index, source_entities, 'Modified'),
	}
}

function find_adposition_context(entity_index: number, source_entities: SourceEntity[]): ContextArguments {
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

function get_outer_context(phrase_index: number, source_entities: SourceEntity[], outer_label: string): ContextArguments {
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

function format_concept(entity: SourceEntity) {
	// remove the pairing part of the value
	const stem = entity.value.split('/')[0]

	return `${stem}-${entity.sense}`
}

function format_clause(clause_index: number, source_entities: SourceEntity[]): string {
	const verb_index = find_verb(clause_index + 1, source_entities)

	return `[${verb_index !== -1 ? format_concept(source_entities[verb_index]) : ''}]`
}

function find_containing_phrase(index: number, source_entities: SourceEntity[]): number {
	// skip_clauses must also be true in case of a relative clause in a NP
	return find_entity_before(is_opening_phrase, { skip_phrases: true, skip_clauses: true, break_condition: is_opening_any_clause })(index, source_entities)
}

function find_containing_clause(index: number, source_entities: SourceEntity[]): number {
	const clause_index = find_entity_before(is_opening_any_clause, { skip_clauses: true })(index, source_entities)

	if (clause_index === -1) {
		throw new Error('Invalid semantic encoding - no containing clause')
	}

	return clause_index
}

/**
 * Find the head word within the phrase at the given index. There is always exactly one head word.
 */
function get_head_word(phrase_index: number, source_entities: SourceEntity[]): SourceEntity {
	const phrase_type = source_entities[phrase_index].label

	const word_type = {
		NP: ['Noun', 'Phrasal'],	// some NPs contain Phrasals that represent Nouns, so we need to consider both
		VP: ['Verb'],
		AdjP: ['Adjective'],
		AdvP: ['Adverb'],
	}[phrase_type] ?? ''

	const head_index = find_entity_after(
		(entity: SourceEntity) => word_type.includes(entity.label),
		{ skip_phrases: true, skip_clauses: true, break_condition: is_closing_phrase }
	)(phrase_index, source_entities)

	if (head_index === -1) {
		console.error(`Invalid semantic encoding - missing head ${word_type} in ${phrase_type}`)

		return { type: '', label: word_type[0], features: '......................', value: '', sense: '' }
	}

	return source_entities[head_index]
}

/**
 * Find the only verb within the clause that the index is within.
 */
function find_verb(index: number, source_entities: SourceEntity[]): number {
	const verb_index = find_entity_before(
		(entity: SourceEntity) => entity.label === 'Verb',
		{ skip_clauses: true, break_condition: is_opening_any_clause },
	)(index, source_entities)

	if (verb_index !== -1) {
		return verb_index
	}

	return find_entity_after(
		(entity: SourceEntity) => entity.label === 'Verb',
		{ skip_clauses: true, break_condition: is_closing_any_clause },
	)(index, source_entities)
}

function find_entity_before(entity_filter: EntityFilter, { skip_phrases = false, skip_clauses = false, break_condition = () => false }: EntityCrawlerInit = {}): EntityCrawlerNext {
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

function find_entity_after(entity_filter: EntityFilter, { skip_phrases = false, skip_clauses = false, break_condition = () => false }: EntityCrawlerInit = {}): EntityCrawlerNext {
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
 * Finds all the arguments that match one of the given filters, and adds it to the context arguments object according to the provided
 * key and value getters. The argument is always at the top level within the phrase or clause located at the provided start_index.
 */
function find_arguments(argument_infos: ArgumentInfo[]): ContextArgumentFinder {
	return (start_index, source_entities) => {
		const context_arguments: ContextArguments = {}
		for (let i = start_index + 1; i < source_entities.length;) {
			const entity = source_entities[i]

			const matched_filter = argument_infos.find(({ filter }) => filter(entity))
			const key = matched_filter?.key(i) || ''
			if (matched_filter && !(key in context_arguments)) {
				// do not overwrite if the key already exists
				// eg. there might be coordinate phrases or clauses, but we only take the first one
				context_arguments[key] = matched_filter.value(i)
			}

			if (is_opening_phrase(entity)) {
				i = skip_to_phrase_end(i, source_entities)
			} else if (is_opening_sub_clause(entity)) {
				i = skip_to_clause_end(i, source_entities)
			} else if ([')', ']', '}'].includes(entity.value)) {
				break
			} else {
				i++
			}
		}

		return context_arguments
	}
}

function is_phrase(entity: SourceEntity, label: string) {
	return entity.label === label
}

function is_opening_sub_clause(entity: SourceEntity) {
	return entity.value === '['
}

function is_opening_phrase(entity: SourceEntity) {
	return entity.value === '('
}

function is_closing_phrase(entity: SourceEntity) {
	return entity.value === ')'
}

function is_closing_sub_clause(entity: SourceEntity) {
	return entity.value === ']'
}

function is_opening_any_clause(entity: SourceEntity) {
	return ['[', '{'].includes(entity.value)
}

function is_closing_any_clause(entity: SourceEntity) {
	return [']', '}'].includes(entity.value)
}

function get_feature_value(entity: SourceEntity, feature: Feature): string {
	return feature.values[entity.features[feature.index]]
}

function has_feature(entity: SourceEntity, feature: Feature, value: FeatureName): boolean {
	return value === feature.values[entity.features[feature.index]]
}

function has_features(entity: SourceEntity, feature: Feature, values: FeatureName[]): boolean {
	return values.includes(feature.values[entity.features[feature.index]])
}

/**
 * @param index the index in source_entities of an opening subordinate clause
 * @return the index after the corresponding closing clause boundary
 */
function skip_to_clause_end(index: number, source_entities: SourceEntity[]) {
	return find_entity_after(is_closing_sub_clause, { skip_clauses: true })(index, source_entities) + 1
}

/**
 * @param index the index in source_entities of a closing subordinate clause
 * @return the index before the corresponding opening clause boundary
 */
function skip_to_clause_start(index: number, source_entities: SourceEntity[]) {
	return find_entity_before(is_opening_sub_clause, { skip_clauses: true })(index, source_entities) - 1
}

/**
 * @param index the index in source_entities of an opening phrase boundary
 * @return the index after the corresponding closing phrase boundary
 */
function skip_to_phrase_end(index: number, source_entities: SourceEntity[]) {
	return find_entity_after(is_closing_phrase, { skip_phrases: true })(index, source_entities) + 1
}

/**
 * @param index the index in source_entities of a closing phrase boundary
 * @return the index before the corresponding opening phrase boundary
 */
function skip_to_phrase_start(index: number, source_entities: SourceEntity[]) {
	return find_entity_before(is_opening_phrase, { skip_phrases: true })(index, source_entities) - 1
}
