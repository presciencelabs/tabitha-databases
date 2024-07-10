# TaBiThA databases

## Ontology

### When a new Ontology is available from TBTA in `mdb` format.

1. Convert the `mdb` to a sqlite database
	> ⚠️ Can't seem to find a commandline tool for this... until something else presents itself, it will need to be done manually.
1. Once in a sqlite format, it should be committed to the `tbta_dbs_as_sqlite` directory following appropriate naming convention.
	> e.g., `Ontology.VERSION.YYYY-MM-DD.mdb.sqlite`
1. Run the `deploy` worklow, i.e., `actions/workflows/deploy.yml`

## Complex Terms

Complex terms will be updated from the "How to" spreadsheet to the database on a regular schedule.

### Testing locally

From within the `complex_terms` dir:

`wrangler dev --test-scheduled`

 Hit `curl 'http://localhost:8787/__scheduled'` in a separate terminal to run it.

### Deployment

> ⚠️ You will need Cloudflare credentials to deploy.

1. Ensure the correct database binding is set in `wrangler.toml`
1. From within `./complex_terms/` run `wrangler deploy`
