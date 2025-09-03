import Cloudflare from 'cloudflare'
import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from 'cloudflare:workers'

type Env = {
	CLOUDFLARE_ACCOUNT_ID: string
	CLOUDFLARE_API_TOKEN: string
	DB_BACKUP_BUCKET: R2Bucket
	WORKFLOW_DB_BACKUP: Workflow
}

type Params = {
	account_id: string
	api_token: string
	db_name: string
}

export default {
	async fetch(): Promise<Response> {
		return new Response('Not Found', { status: 404 })
	},

	async scheduled(controller: ScheduledController, env: Env): Promise<void> {
		const params: Params = {
			account_id: env.CLOUDFLARE_ACCOUNT_ID,
			api_token: env.CLOUDFLARE_API_TOKEN,
			db_name: 'Ontology.9492.2025-08-12',
		}

		try {
			const instance = await env.WORKFLOW_DB_BACKUP.create({ params })
			await instance.status() // had to do this to get workflow to run
		} catch (error) {
			console.error('Error creating workflow instance:', error)
		}
	},
}

// https://developers.cloudflare.com/workflows
export class DbBackupWorkflow extends WorkflowEntrypoint<Env, Params> {
	async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
		console.log('Starting DB backup workflow')

		const { account_id, api_token: apiToken, db_name } = event.payload
		const bucket = this.env.DB_BACKUP_BUCKET

		const client = new Cloudflare({ apiToken })

		const db_info = await step.do('get database info', get_db_info)
		const bookmark = await step.do('start the export', start_db_export)
		const dump_info = await step.do('poll for completion', poll_for_completion)
		await step.do('save dump', save_dump)

		async function get_db_info() {
			console.log('Listing databases...')

			const { result } = await client.d1.database.list({
				account_id,
				name: db_name,
			})

			console.log('Found:', result)

			return result[0]
		}

		async function start_db_export() {
			if (!db_info?.uuid) throw new Error(`No db found by the name ${db_name}`)

			console.log('Starting the export for: ', db_info)

			const response = await client.d1.database.export(db_info.uuid, {
				account_id,
				output_format: 'polling',
			})

			// ref:  https://developers.cloudflare.com/workflows/examples/backup-d1
			if (!response?.at_bookmark) throw new Error(`Failed to start export for db ${db_name}`)

			console.log('Export initiated:', response)

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
			if (!dump_info?.signed_url) throw new Error('No dump info found')

			// @ts-ignore CF's response structure changes based on state  :-(
			console.log('Saving dump to R2 for: ', dump_info.signed_url)

			// @ts-ignore CF's response structure changes based on state  :-(
			const dump_response = await fetch(dump_info.signed_url)
			// @ts-ignore CF's response structure changes based on state  :-(
			if (!dump_response.ok) throw new Error(`Failed to fetch dump file at ${dump_info.signed_url}`)

			const put_response = await bucket.put(`${db_name}.tabitha.sql`, dump_response.body)

			console.log('Saved dump to R2', put_response)
		}
	}
}
