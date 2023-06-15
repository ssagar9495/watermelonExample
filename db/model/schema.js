import { appSchema, tableSchema } from '@nozbe/watermelondb'

export const DB_CONFIG = {};

export default appSchema({
    version: 1,
    tables: [
        tableSchema({
            name: 'accounts',
            columns: [
                { name: 'name', type: 'string' },
                { name: 'credit', type: 'number' },
                { name: 'debit', type: 'number' },
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
            ]
        }),
        tableSchema({
            name: 'transactions',
            columns: [
                { name: 'amount', type: 'number' },
                { name: 'account_id', type: 'string', },
                { name: 'type', type: 'number', },
                { name: 'date', type: 'number', },
                { name: 'note', type: 'string', isOptional: true },
                { name: 'created_at', type: 'number', },
                { name: 'updated_at', type: 'number', },
            ]
        }),
    ]
})