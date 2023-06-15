import { Model } from '@nozbe/watermelondb';
import { field, date, readonly, relation, writer } from '@nozbe/watermelondb/decorators';

export default class Transactions extends Model {
    static table = 'transactions';
    static associations = {
        accounts: { type: 'belongs_to', key: 'account_id' },
    }

    @field('amount') amount
    @field('account_id') accountId
    @field('type') type
    @field('date') date
    @field('note') note

    @readonly @date('created_at') createdAt
    @readonly @date('updated_at') updatedAt

    @relation('accounts', 'account_id') account

    @writer async updateTransaction(data) {
        await this.update(transaction => {
            transaction.note = data.note;
            transaction.date = data.date;
            transaction.amount = data.amount;
            transaction.type = data.type;
        });
    }
}