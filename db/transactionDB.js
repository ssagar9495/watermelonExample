import AccountsDB, { startOfDay, endOfDay } from './accountsDB'

import TransactionModel from './model/transaction'
import AccountModel from './model/account'
import { Q } from '@nozbe/watermelondb'
import DBHandler from './index'
import sumBy from 'lodash/sumBy'
import { TRANSACTION_TYPE } from 'src/constants/constants'

class TransactionDB {
  static _collection = DBHandler.db.get(TransactionModel.table)

  static getAmount(isGetCredit = true, transaction) {
    const isTransactionCredit = transaction?.type === TRANSACTION_TYPE.CREDIT
    if (isGetCredit) {
      return isTransactionCredit ? transaction.amount : 0
    } else {
      return !isTransactionCredit ? transaction.amount : 0
    }
  }

  static async fetchTransactions(accountId, filters) {
    return new Promise(async resolve => {
      try {
        const query = [Q.where('account_id', accountId)]

        if (filters?.transactionType) {
          query.push(Q.where('type', filters?.transactionType))
        }
        if (filters?.note) {
          query.push(Q.where('note', Q.like(`%${Q.sanitizeLikeString(filters?.note)}%`)))
        }
        if (parseFloat(filters?.amount)) {
          query.push(
            Q.where(
              'amount',
              filters?.sortOrder ? Q.gte(parseFloat(filters?.amount)) : Q.lte(parseFloat(filters?.amount))
            )
          )
        }
        if (filters?.fromDate && filters?.toDate) {
          query.push(
            Q.and(
              Q.where('date', Q.gte(+startOfDay(filters?.fromDate))),
              Q.where('date', Q.lte(+endOfDay(filters?.toDate)))
            )
          )
        } else if (filters?.fromDate) {
          query.push(Q.where('date', Q.gte(+startOfDay(filters?.fromDate))))
        } else if (filters?.toDate) {
          query.push(Q.where('date', Q.lte(+endOfDay(filters?.toDate))))
        }

        const size = await this._collection.query(Q.where('account_id', accountId)).fetchCount()
        if (filters?.sortKey) {
          query.push(Q.sortBy(filters?.sortKey, filters?.sortOrder ? Q.asc : Q.desc))
        }
        const data = await this._collection.query(...query).fetch()

        //TODO: Consider better solutions than sumBy here.
        resolve({
          credit: sumBy(data, this.getAmount.bind(this, true)),
          debit: sumBy(data, this.getAmount.bind(this, false)),
          data,
          size
        })
      } catch (err) {
        console.log({ err })
      }
    })
  }

  static async addNewTransaction(data) {
    try {
      await DBHandler.db.write(async () => {
        await this._collection.create(trans => {
          trans.note = data.note
          trans.amount = data.amount
          trans.accountId = data.accountId
          trans.date = data.date
          trans.type = data.type
        })
      })
    } catch (err) {
      console.log({ err })
    }

    // Update total in specific Account
    await AccountsDB.updateCreditDebit({
      id: data?.accountId,
      transactionObj: {
        type: data?.type,
        amount: data?.amount
      },
      isAddOperation: true
    })
  }

  static async updateTransaction(id, data = {}) {
    const transaction = await this._collection.find(id)
    if (transaction) {
      await AccountsDB.updateCreditDebit({
        id: transaction?.accountId,
        transactionObj: {
          type: transaction?.type,
          amount: transaction?.amount
        },
        isAddOperation: false
      })

      await transaction.updateTransaction(data)

      await AccountsDB.updateCreditDebit({
        id: transaction?.accountId,
        transactionObj: {
          type: data?.type,
          amount: data?.amount
        },
        isAddOperation: true
      })
    }
  }

  static async deleteTransaction(transactionId) {
    return await DBHandler.db.write(async () => {
      const transaction = await this._collection.find(transactionId)
      const account = await DBHandler.db.get(AccountModel.table).find(transaction?.accountId)
      if (transaction) {
        await account.update(acc => {
          if (transaction.type === TRANSACTION_TYPE.CREDIT) acc.credit -= transaction.amount
          else if (transaction.type === TRANSACTION_TYPE.DEBIT) acc.debit -= transaction.amount
        })
        // await transaction.destroyPermanently()
        await transaction.markAsDeleted()
      }
    })
  }

  static async moveCopyTransaction(id, data, acckey) {
    if (acckey === 1) {
      try {
        return await TransactionDB.addNewTransaction({
          accountId: id,
          amount: data?.amount,
          date: data?.date,
          note: data?.note,
          type: data?.type
        })
      } catch (error) {
        return error
      }
    } else {
      return new Promise(async (resolve, reject) => {
        try {
          await TransactionDB.deleteTransaction(data?.id)
          await TransactionDB.addNewTransaction({
            accountId: id,
            amount: data?.amount,
            date: data?.date,
            note: data?.note,
            type: data?.type
          })
          resolve(true)
        } catch (err) {
          reject(err)
        }
      })
    }
  }
}

export default TransactionDB
