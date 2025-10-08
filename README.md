# TaBiThA databases

https://www.sqlite.org

## Interacting with a database locally

### GUI

https://sqlitebrowser.org has been a good tool and it's free

### Command line

`sqlite3` is needed, thankfully for Mac users it's already installed, otherwise:  https://www.sqlite.org/download.html

#### Getting help

##### Interactive

1. `sqlite3`
1. `sqlite> .help` *https://www.sqlite.org/cli.html#special_commands_to_sqlite3_dot_commands_*
1. `^d` to exit shell

##### Man page

https://www.sqlite.org/cli.html#command_line_options
`sqlite3 -help`

### Dump

`sqlite3 example.sqlite .dump > example.sqlite.sql`

### Diffing to understand changes

Databases can be diffed using sqldiff (https://www.sqlite.org/sqldiff.html), Mac users `brew install sqldiff`

## Hosting service

https://developers.cloudflare.com/d1
https://developers.cloudflare.com/workers/wrangler/commands/#d1

https://developers.cloudflare.com/workers/wrangler

### Create database

`bun wrangler d1 create <DB_NAME>`

> This always creates the database remotely and locally, it is empty though.

### Interacting with the database

> `--local` only operates on the local copy and is the default in wrangler v3.33.0+
> `--remote` operates on the remote database

`bun wrangler d1 execute <DB_NAME> --file <DB_NAME>.tabitha.sqlite.sql`

`bun wrangler d1 execute <DB_NAME> --command="select part_of_speech, count(*) as count from Concepts group by part_of_speech order by count; select * from Version;"`

## Deployment

`bun migrate <location of a zip containing TBTA dbs> YYYY-MM`

### Ontology

> ⚠️ Don't forget to update the `DB_Ontology` binding for the `sync_complex_terms` Worker when a new Ontology is created.

### Complex Terms

Complex terms will be updated from the "How to" spreadsheet to the database on a regular schedule.

#### Testing locally

From within the `complex_terms` dir:

`bun wrangler dev --test-scheduled`

 Hit `curl 'http://localhost.tabitha.bible:8787/__scheduled'` in a separate terminal to run it.

#### Deployment

1. Ensure the correct database binding is set in `wrangler.toml`
1. Commit and push, deployment will occur automatically

### Sources

No special instructions required to generate or deploy.

### Targets

#### When any new project is available from TBTA

> ⚠️ Ensure the inflections have already been exported before attempting the migration using the corresponding set of TBTA files, see `./targets/inflections/README.md` for instructions (must be done manually).

### Auth

This database should not need to be deployed on a regular basis.  Updates will either be made directly to an already deployed database or via an app.

### Database backups

DB backups are handled via `wrangler` and stored in R2.

#### Testing locally

`cp db_backup/.env.example .env` and populate with a valid tokens

> ⚠️ exports will **BLOCK** the database so you might want to tweak the __get_latest_database_name()__ logic during testing to "find" a database that is not currently the production version.

`bun run db_backup/index.ts`

#### Deployment

Merging into `main` will automatically make the workflow available on its schedule.

## Local migrations

> _order coupling_
>
> * Bible -> Sources -> Ontology
> * Inflections -> English -> Targets

### Sources

#### Create the TaBiThA database from the TBTA version

`bun sources/migrate.ts databases/Bible.YYYY-MM-DD.tbta.sqlite databases/Community_Development_Texts.YYYY-MM-DD.tbta.sqlite databases/Grammar_Introduction.YYYY-MM-DD.tbta.sqlite databases/Sources.YYYY-MM-DD.tabitha.sqlite`

#### Dump to a `.sql` file

`sqlite3 databases/Sources.YYYY-MM-DD.tabitha.sqlite .dump | grep -Ev "^PRAGMA|^BEGIN TRANSACTION|^COMMIT" > databases/Sources.YYYY-MM-DD.tabitha.sqlite.sql`

### Ontology

#### Create the TaBiThA database from the TBTA version

`bun ontology/migrate.ts databases/Ontology.VERSION.YYYY-MM-DD.tbta.sqlite databases/Sources.YYYY-MM-DD.tabitha.sqlite databases/Ontology.VERSION.YYYY-MM-DD.tabitha.sqlite`

#### Dump to a `.sql` file

`sqlite3 databases/Ontology.VERSION.YYYY-MM-DD.tabitha.sqlite .dump | grep -Ev "^PRAGMA|^BEGIN TRANSACTION|^COMMIT" > databases/Ontology.VERSION.YYYY-MM-DD.tabitha.sqlite.sql`

### Targets

#### Create the TaBiThA database from the TBTA version

> ⚠️ Ensure the inflections have already been exported using the corresponding set of TBTA files, see `./targets/inflections/README.md` for instructions (must be done manually).

`bun targets/migrate.ts databases/English.YYYY-MM-DD.tbta.sqlite databases/Targets.YYYY-MM-DD.tabitha.sqlite`

#### Dump to a `.sql` file

`sqlite3 databases/Targets.YYYY-MM-DD.tabitha.sqlite .dump | grep -Ev "^PRAGMA|^BEGIN TRANSACTION|^COMMIT" > databases/Targets.YYYY-MM-DD.tabitha.sqlite.sql`

### Auth

If needed, the database can be recreated using `bun auth/create.ts`

Typically, for local testing, one will need to interact with the database that has been loaded into a project's wrangler environment to add users to the User table.
