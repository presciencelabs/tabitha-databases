import Database from 'bun:sqlite'

const auth_db = new Database('./databases/Auth.tabitha.sqlite')
create_user_table(auth_db)
create_permissions_table(auth_db)
create_user_permissions_table(auth_db)

auth_db.run(`VACUUM`)
console.log('done.')

function create_user_table(db: Database) {
	console.log('Creating Users table...')
	db.run('DROP TABLE Users')

	db.run(`
		CREATE TABLE IF NOT EXISTS Users (
			email		TEXT PRIMARY KEY,
			name		TEXT
		)
	`)
}

function create_permissions_table(db: Database) {
	console.log('Creating Permissions table...')
	db.run(`
		CREATE TABLE IF NOT EXISTS Permissions (
			id				INTEGER PRIMARY KEY,
			app			TEXT,
			permission	TEXT
		)
	`)

	const insert = db.prepare('INSERT INTO Permissions (id, app, permission) VALUES (?, ?, ?)');
	const insertMany = db.transaction((permissions) => {
		for (const permission of permissions) {
			insert.run(...permission)
		}
	})

	insertMany([
		[1, 'ontology', 'PROTECTED_ACCESS'],
		[2, 'ontology', 'ADD_CONCEPT'],
		[3, 'ontology', 'UPDATE_CONCEPT'],
		[4, 'ontology', 'DELETE_CONCEPT'],
	])
}

function create_user_permissions_table(db: Database) {
	console.log('Creating User_Permissions table...')
	db.run(`
		CREATE TABLE IF NOT EXISTS User_Permissions (
			user_email	TEXT,
			permission_id	INTEGER
		)
	`)
}
