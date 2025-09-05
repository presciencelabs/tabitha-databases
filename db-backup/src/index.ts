import Cloudflare from 'cloudflare'
import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from 'cloudflare:workers'

type Env = {
	CLOUDFLARE_ACCOUNT_ID: string
	CLOUDFLARE_API_TOKEN: string
	BUCKET_DB_BACKUP: R2Bucket
	WORKFLOW_DB_BACKUP: Workflow
}

type Params = {
	account_id: string
	api_token: string
}

export default {
	async fetch(): Promise<Response> {
		return new Response('Not Found', { status: 404 })
	},

	async scheduled(controller: ScheduledController, env: Env): Promise<void> {
		if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_API_TOKEN) throw 'Missing required environment variables'

		const params: Params = {
			account_id: env.CLOUDFLARE_ACCOUNT_ID,
			api_token: env.CLOUDFLARE_API_TOKEN,
		}

		try {
			const instance = await env.WORKFLOW_DB_BACKUP.create({ params })
			await instance.status() // had to do this to get workflow to run
		} catch (error) {
			throw `Error creating workflow instance: ${error}`
		}
	},
}

// https://developers.cloudflare.com/workflows
export class DbBackupWorkflow extends WorkflowEntrypoint<Env, Params> {
	async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
		console.log('Starting DB backup workflow')

		const { account_id, api_token } = event.payload
		const bucket = this.env.BUCKET_DB_BACKUP

		const client = new Cloudflare({ apiToken: api_token })

		// https://developers.cloudflare.com/workflows/build/workers-api/#step
		// default config:  https://developers.cloudflare.com/workflows/build/sleeping-and-retrying/#retry-steps
		const db_info = await step.do('get database info', get_db_info)
		const bookmark = await step.do('start the export', start_db_export)
		const dump_info = await step.do('poll for completion', poll_for_completion)
		await step.do('save dump', save_dump)

		async function get_db_info() {
			console.log('Listing databases...')

			// https://developers.cloudflare.com/api/node/resources/d1/subresources/database/methods/list
			const { result } = await client.d1.database.list({
				account_id,
				name: 'Ontology', // API searches for closest name match, i.e., filters list down to those starting with 'Ontology'
			})

			// anything returned from step must be serializable, https://developers.cloudflare.com/workflows/build/workers-api/#step
			return latest()

			function latest() {
				return result
							// @ts-expect-error (created_at will never be undefined here)
							.sort((a, b) => a.created_at.localeCompare(b.created_at)) // ascending, i.e., most recent at end
							.at(-1) // last one in list
			}
		}

		async function start_db_export() {
			if (!db_info?.uuid || !db_info?.name) throw new Error(`Missing critical db info: ${JSON.stringify(db_info)}`)

			console.log('Starting the export for: ', db_info)

			// https://developers.cloudflare.com/api/node/resources/d1/subresources/database/methods/export/
			const response = await client.d1.database.export(db_info.uuid, {
				account_id,
				output_format: 'polling',
			})

			// ref:  https://developers.cloudflare.com/workflows/examples/backup-d1
			if (!response?.at_bookmark) throw new Error(`Failed to start export for db ${db_info.name}`)

			console.log('Export initiated:', response)

			// anything returned from step must be serializable, https://developers.cloudflare.com/workflows/build/workers-api/#step
			return response.at_bookmark
		}

		async function poll_for_completion() {
			console.log('Polling for completion...')

			// @ts-ignore CF's options structure changes based on type of request  :-(
			const response = await client.d1.database.export(db_info.uuid, {
				account_id,
				current_bookmark: bookmark,
			})

			console.log('Poll response:', {response, bookmark})
			// @ts-ignore CF's response structure changes based on state  :-(
			if (response.signed_url) return response

			if (response.status === 'error') throw new Error(`Export failed: ${response.error}`)
		}

		async function save_dump() {
			// @ts-ignore CF's response structure changes based on state  :-(
			if (!dump_info?.signed_url || !db_info?.name) throw new Error(`No dump info found: ${JSON.stringify(dump_info)}`)

			// @ts-ignore CF's response structure changes based on state  :-(
			console.log('Saving dump to R2 for: ', dump_info.signed_url)

			// @ts-ignore CF's response structure changes based on state  :-(
			const dump_response = await fetch(dump_info.signed_url)
			// @ts-ignore CF's response structure changes based on state  :-(
			if (!dump_response.ok) throw new Error(`Failed to fetch dump file at ${dump_info.signed_url}`)

			const put_response = await bucket.put(`${db_info.name}.tabitha.sql`, dump_response.body)

			console.log('Saved dump to R2', put_response)
		}
	}
}
