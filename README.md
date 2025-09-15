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

`pnpx wrangler ...` will also work if you do not want to install wrangler

### Create database

`wrangler d1 create <DB_NAME>`

> This always creates the database remotely and locally, it is empty though.

### Interacting with the database

> `--local` only operates on the local copy and is the default in wrangler v3.33.0+
> `--remote` operates on the remote database

`wrangler d1 execute <DB_NAME> --file=<DB_NAME>.tabitha.sqlite.sql`

`wrangler d1 execute <DB_NAME> --command="select part_of_speech, count(*) as count from Concepts group by part_of_speech order by count; select * from Version;"`

## Deployment

Check each databases's approach below.

### Ontology

#### When a new Ontology is available from TBTA

> ⚠️ due to order coupling, this is not accurate anymore, everything must be done locally, see Local migrations below.

1. The new database should be committed to the `databases` directory following appropriate naming convention.
	> e.g., `Ontology.VERSION.YYYY-MM-DD.tbta.sqlite`
1. Run the `deploy` worklow, i.e., `actions/workflows/deploy.yml`
1. Update the Cloudflare `DB_Ontology` binding for the `sync_complex_terms` Worker.

### Complex Terms

Complex terms will be updated from the "How to" spreadsheet to the database on a regular schedule.

#### Testing locally

From within the `complex_terms` dir:

`wrangler dev --test-scheduled`

 Hit `curl 'http://localhost.tbta.bible:8787/__scheduled'` in a separate terminal to run it.

#### Deployment

1. Ensure the correct database binding is set in `wrangler.toml`
1. Commit and push, deployment will occur automatically

### Sources

#### When a new Bible, Community Development Text, and/or Grammar Introduction is available from TBTA

> ⚠️ due to order coupling, this is not accurate anymore, everything must be done locally, see Local migrations below.

1. Once in a sqlite format, it should be committed to the `databases` directory following appropriate naming convention.
	> e.g., `Bible.YYYY-MM-DD.tbta.sqlite Community_Development_Texts.YYYY-MM-DD.tbta.sqlite Grammar_Introduction.YYYY-MM-DD.tbta.sqlite`
1. Run the `deploy` worklow, i.e., `actions/workflows/deploy.yml`

### Targets

#### When any new project is available from TBTA

> ⚠️ due to order coupling, this is not accurate anymore, everything must be done locally, see Local migrations below.

1. Ensure the inflections have already been exported using the corresponding set of TBTA files, see `./targets/inflections/README.md` for instructions (must be done manually).
1. Once in a sqlite format, it should be committed to the `databases` directory following appropriate naming convention.
	> Example naming convention: `English.YYYY-MM-DD.tbta.sqlite`
1. Once the new sqlite db and the inflections are in place, they can be part of the same `commit` and pushed.
1. Manually run the `deploy` worklow, i.e., `actions/workflows/deploy.yml`

### Auth

This database should not need to be deployed on a regular basis.  Updates will either be made directly to an already deployed database or via an app.

### Database backups

DB backups are handled via `wrangler` and stored in R2.

#### Testing locally

`cp db_backup/.env.example .env` and populate with a valid token

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
