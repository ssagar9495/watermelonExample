import { Model } from '@nozbe/watermelondb'
import { map, distinctUntilChanged } from 'rxjs/operators'
import TransactionModel from '../model/transaction'
import { field, text, date, children, readonly, writer, lazy } from '@nozbe/watermelondb/decorators'
import { TRANSACTION_TYPE } from 'src/constants/constants'

export default class Account extends Model {
  static table = 'accounts'
  static associations = {
    transactions: { type: 'has_many', foreignKey: 'account_id' }
  }

  @text('name') name
  @field('credit') credit
  @field('debit') debit
  @readonly @date('created_at') createdAt
  @readonly @date('updated_at') updatedAt

  @children('transactions') transactions

  @lazy credit1 = this.transactions.observeCount().pipe(
    map(transaction => {
      return transaction
    })
    // distinctUntilChanged()
  )

  // @lazy debit1 = this.transactions.observeCount();

  @writer async updateAccount({ name, amount, type }) {
    await this.update(account => {
      if (name) account.name = name
      if (type === TRANSACTION_TYPE.CREDIT) {
        account.credit += amount
      } else if (type === TRANSACTION_TYPE.DEBIT) {
        account.debit += amount
      }
    })
  }

  @writer async updateAccountAbsolute(obj) {
    await this.update(account => {
      if (obj?.name) account.name = obj?.name
      if (obj?.debit !== undefined) account.debit = obj?.debit
      if (obj?.credit !== undefined) account.credit = obj?.credit
    })
  }

  @writer async deleteAccount() {
    const transactions = await this.transactions.fetch()
    // const batchDelete = transactions.map(it => it.prepareDestroyPermanently());
    // await this.batch(this.prepareDestroyPermanently(), ...batchDelete);
    const batchDelete = transactions.map(it => it.prepareMarkAsDeleted())
    await this.batch(this.prepareMarkAsDeleted(), ...batchDelete)
  }

  @writer async duplicateTransactionForAccount(fromAccount, transactionCollection) {
    const transactions = await fromAccount.transactions.fetch()
    const transactionBuilders = []
    let credit = 0
    let debit = 0
    // transactionBuilders.push(
    //     this.prepareUpdate(acc => {
    //         if (data.type === TRANSACTION_TYPE.CREDIT) acc.credit += data.amount;
    //         else if (data.type === TRANSACTION_TYPE.DEBIT) acc.debit += data.amount;
    //     })
    // )
    transactions.forEach(data => {
      transactionBuilders.push(
        transactionCollection.prepareCreate(trans => {
          trans.note = data.note
          trans.amount = data.amount
          trans.accountId = this.id
          trans.date = data.date
          trans.type = data.type
        })
      )
      if (data.type === TRANSACTION_TYPE.CREDIT) credit += data.amount
      else if (data.type === TRANSACTION_TYPE.DEBIT) debit += data.amount
    })

    await this.batch(
      ...transactionBuilders,
      this.prepareUpdate(acc => {
        acc.credit = credit
        acc.debit += debit
      })
    )
  }
}
