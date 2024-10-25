# TaBiThA databases

https://www.sqlite.org

## Converting `mdb` to `sqlite`

We are currently using a manual process, i.e., TBTA's `Ontology.mdb` -> Google Drive -> MDB Viewer app -> download sqlite file (`Ontology.VERSION.YYY-MM-DD.tbta.sqlite`)

> if an mdb is larger than 40M, the MDB Viewer app will not work unfortunately.  There is an option to buy MDB ACCB Viewer (for Macs).

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

### Ontology (⚠️ see Exhaustive examples section below... Ontology must be manually deployed temporarily)

#### When a new Ontology is available from TBTA in `mdb` format.

1. Convert the `mdb` to a sqlite database
	> ⚠️ Can't seem to find a commandline tool for this... until something else presents itself, it will need to be done manually.
1. Once in a sqlite format, it should be committed to the `databases` directory following appropriate naming convention.
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

> ⚠️ You will need Cloudflare credentials to deploy.

1. Ensure the correct database binding is set in `wrangler.toml`
1. From within `./complex_terms/` run `wrangler deploy`

### Sources

#### When a new Bible, Community Development Text, or Grammar Introduction is available from TBTA in `mdb` format.

1. Convert the `mdbs` to their respective sqlite databases
	> ⚠️ Can't seem to find a commandline tool for this... until something else presents itself, it will need to be done manually.
1. Once in a sqlite format, it should be committed to the `databases` directory following appropriate naming convention.
	> e.g., `Bible.YYYY-MM-DD.tbta.sqlite Community_Development_Texts.YYYY-MM-DD.tbta.sqlite Grammar_Introduction.YYYY-MM-DD.tbta.sqlite`
1. Run the `deploy` worklow, i.e., `actions/workflows/deploy.yml`

### Targets

#### When any new project is available from TBTA in `mdb` format.

1. Ensure the inflections have already been exported using the corresponding set of TBTA files, see `./targets/inflections/README.md` for instructions (must be done manually).
1. Convert the `mdb` to a sqlite database and place in the `databases` directory with appropriate naming convention.
	> ⚠️ Can't seem to find a commandline tool for this... until something else presents itself, it will need to be done manually.

	> Example naming convention: `English.YYYY-MM-DD.tbta.sqlite`
1. Once the new sqlite db and the inflections are in place, they can be part of the same `commit` and pushed.
1. Manually run the `deploy` worklow, i.e., `actions/workflows/deploy.yml`

## Local migration

### Ontology

#### Create the TaBiThA database from an `.mdb`

`bun ontology/migrate.js databases/Ontology.VERSION.YYYY-MM-DD.tbta.sqlite databases/Ontology.VERSION.YYYY-MM-DD.tabitha.sqlite`

#### Dump to a `.sql` file

`sqlite3 databases/Ontology.VERSION.YYYY-MM-DD.tabitha.sqlite .dump | grep -Ev "^PRAGMA|^BEGIN TRANSACTION|^COMMIT" > databases/Ontology.VERSION.YYYY-MM-DD.tabitha.sqlite.sql`

### Sources

#### Create the TaBiThA database from an `.mdb`

`bun sources/migrate.js databases/Bible.YYYY-MM-DD.tbta.sqlite databases/Community_Development_Texts.YYYY-MM-DD.tbta.sqlite databases/Grammar_Introduction.YYYY-MM-DD.tbta.sqlite databases/Sources.YYYY-MM-DD.tabitha.sqlite`

#### Dump to a `.sql` file

`sqlite3 databases/Sources.YYYY-MM-DD.tabitha.sqlite .dump | grep -Ev "^PRAGMA|^BEGIN TRANSACTION|^COMMIT" > databases/Sources.YYYY-MM-DD.tabitha.sqlite.sql`

### Targets

#### Create the TaBiThA database from an `.mdb`

> ⚠️ Ensure the inflections have already been exported using the corresponding set of TBTA files, see `./targets/inflections/README.md` for instructions (must be done manually).

`bun targets/migrate.js English.YYYY-MM-DD.tbta.sqlite targets/Targets.YYYY-MM-DD.tabitha.sqlite`

#### Dump to a `.sql` file

`sqlite3 targets/Targets.YYYY-MM-DD.tabitha.sqlite .dump | grep -Ev "^PRAGMA|^BEGIN TRANSACTION|^COMMIT" > targets/Targets.YYYY-MM-DD.tabitha.sqlite.sql`


### Exhaustive examples

This is a data generation and load process that updates the Ontology database.

> ⚠️ Local copies of the **Ontology** and **Sources** *TaBiThA* databases are required for this data generation.

`bun exhaustive_examples/load.js databases/Ontology.VERSION.YYYY-MM-DD.tabitha.sqlite databases/Sources.YYYY-MM-DD.tabitha.sqlite`
