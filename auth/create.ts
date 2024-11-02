import Database from 'bun:sqlite'

const auth_db = new Database('./databases/Auth.tabitha.sqlite')

auth_db.run(`
	CREATE TABLE IF NOT EXISTS Users (
		email TEXT PRIMARY KEY,
		app TEXT
	)
`)

// once permissions become relevant, favor granular permissions over roles, e.g.,
//
// Permissions table:
//
// | app 		| permission		|
// | --------- | --------------- |
// | ontology	| ADD_USER			|
// | ontology	| ADD_CONCEPT 		|
// | ontology	| UPDATE_CONCEPT	|
// | ontology	| DELETE_CONCEPT	|
