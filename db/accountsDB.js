import TransactionDB from './transactionDB'
import { toast } from 'react-toastify'
import DBHandler from './index'
import AccountModel from './model/account'
import TransactionModel from './model/transaction'
import { Q } from '@nozbe/watermelondb'
import { store } from '../redux/store'
import { ACCOUNT_SORT_OPTIONS } from 'src/constants/constants'
import { SortBy } from '@nozbe/watermelondb/QueryDescription'
import moment from 'moment'
import { TRANSACTION_TYPE } from 'src/constants/constants'

export const startOfDay = date => {
  date.setHours(0, 0, 0, 0)
  return new Date(date)
}

export const endOfDay = date => {
  date.setHours(23, 59, 59, 999)
  return new Date(date)
}

class AccountsDB {
  static _collection = DBHandler.db.get(AccountModel.table)

  static async getAllAccountsTotal() {
    const response = { credit: 0, debit: 0 }
    try {
      const res = await this._collection.query().fetch()
      res.forEach(account => {
        response.credit += account.credit
        response.debit += account.debit
      })

      return response
    } catch (err) {
      return response
    }
  }

  static async createNewAccount({ name, duplicateId }) {
    let account = undefined
    let accountName = `${name}${duplicateId ? ' - duplicate' : ''} `
    await DBHandler.db.write(async () => {
      account = await this._collection.create(acc => {
        acc.name = accountName
      })
    })

    //If action is duplicate, copy the transactions
    if (duplicateId) {
      const fromAccount = await this._collection.find(duplicateId)
      await account.duplicateTransactionForAccount(fromAccount, DBHandler.db.get(TransactionModel.table))
    }

    toast.success(`${accountName} created Successfully!`)
    return account
  }

  static fetchAllAccounts() {
    return new Promise(async resolve => {
      try {
        const accountSortIndex = store?.getState().filterReducer?.filterValue
        const query = []
        if (typeof accountSortIndex === 'number') {
          const SORT_OPTIONS = ACCOUNT_SORT_OPTIONS[accountSortIndex]
          query.push(Q.sortBy(SORT_OPTIONS.sortKey, SORT_OPTIONS.sortOrder))
        }
        const data = await this._collection.query(...query).fetch()
        resolve(data)
      } catch (err) {
        console.log({ err })
      }
    })
  }

  static fetchAccount(accountId) {
    return new Promise(async resolve => {
      try {
        const data = await this._collection.query(Q.where('id', accountId)).fetch()
        resolve(data)
      } catch (err) {
        console.log({ err })
      }
    })
  }

  static async renameAccount({ id, name }) {
    const account = await this._collection.find(id)
    if (account) await account.updateAccount({ name })
  }

  static async deleteAccount({ id }) {
    const account = await this._collection.find(id)
    if (account) await account.deleteAccount()
    toast.error(`${account?.name} deleted Succesfully!`, true)
  }

  static async updateCreditDebit({ id, transactionObj, isAddOperation = true }) {
    const difference = isAddOperation ? transactionObj?.amount : -transactionObj?.amount
    const account = await this._collection.find(id)
    if (account)
      await account.updateAccount({
        amount: difference,
        type: transactionObj?.type
      })
  }

  /**
   *
   * @param id - account_id string
   * @param month - month date object
   * @returns weekWise and dateWise date for Stats - Calendar Screen
   */
  static getStatsForCalendar({ id, month }) {
    return new Promise(async resolve => {
      try {
        const startOfMonth = moment(month).startOf('month')
        const endOfMonth = moment(month).endOf('month')
        const startDate = new Date(startOfMonth.toISOString())
        const endDate = new Date(endOfMonth.toISOString())
        const query = []

        if (id === 'all') {
          const accounts = await this._collection.query().fetch()
          query.push(Q.or(...accounts.map(acc => Q.where('account_id', acc.id))))
        } else {
          query.push(Q.where('account_id', id))
        }

        query.push(Q.and(Q.where('date', Q.gte(+startOfDay(startDate))), Q.where('date', Q.lte(+endOfDay(endDate)))))

        const transactions = await TransactionDB._collection.query(...query).fetch()

        const totalWeeksInMonth = endOfMonth.weeks() - startOfMonth.weeks() + 1

        const dateWise = {}

        const weekWise = new Array(totalWeeksInMonth).fill({}).map((_, i) => ({
          label: `Week ${i + 1}`,
          credit: 0,
          debit: 0
        }))

        transactions.forEach(item => {
          const key = moment(item.date).format('D')
          if (!dateWise[key]) {
            dateWise[key] = { credit: 0, debit: 0 }
          }
          const currentWeekIndex = moment(item.date).weeks() - moment(item.date).startOf('month').weeks()

          if (item?.type === TRANSACTION_TYPE.DEBIT) {
            dateWise[key].debit = dateWise[key].debit + item.amount
            weekWise[currentWeekIndex].debit += item.amount
          } else {
            dateWise[key].credit = dateWise[key].credit + item.amount
            weekWise[currentWeekIndex].credit += item.amount
          }
        })

        resolve({
          weekWise,
          dateWise
        })
      } catch (err) {
        console.log({ err })
      }
    })
  }

  /**
   *
   * @param id - account_id string
   * @param date - year date object
   * @returns weekWise and dateWise date for Stats - Annual Report Screen
   */
  static getStateForAnnualReport({ id, date }) {
    return new Promise(async resolve => {
      try {
        const query = []

        if (id === 'all') {
          const accounts = await this._collection.query().fetch()
          query.push(Q.or(...accounts.map(acc => Q.where('account_id', acc.id))))
        } else {
          query.push(Q.where('account_id', id))
        }
        const startOfYear = moment(date).startOf('year')
        const endOfYear = moment(date).endOf('year')
        const startDate = new Date(startOfYear.toISOString())
        const endDate = new Date(endOfYear.toISOString())
        query.push(Q.and(Q.where('date', Q.gte(+startOfDay(startDate))), Q.where('date', Q.lte(+endOfDay(endDate)))))

        const transactions = await TransactionDB._collection.query(...query).fetch()

        const total = { credit: 0, debit: 0 }

        const monthWise = ANNUAL_REPORT_ITEMS.map(item => ({
          ...item,
          credit: 0,
          debit: 0
        }))

        transactions.forEach(item => {
          const key = moment(item.date).format('D')

          const currentMonthIndex = moment(item.date).get('month')

          if (item?.type === TRANSACTION_TYPE.DEBIT) {
            total.debit = total.debit + item.amount
            monthWise[currentMonthIndex].debit += item.amount
          } else {
            total.credit = total.credit + item.amount
            monthWise[currentMonthIndex].credit += item.amount
          }
        })

        resolve({
          total,
          monthWise
        })
      } catch (err) {
        console.log({ err })
      }
    })
  }
}

export default AccountsDB

const ANNUAL_REPORT_ITEMS = [
  {
    label: 'January'
  },
  {
    label: 'February'
  },
  {
    label: 'March'
  },
  {
    label: 'April'
  },
  {
    label: 'May'
  },
  {
    label: 'June'
  },
  {
    label: 'July'
  },
  {
    label: 'August'
  },
  {
    label: 'September'
  },
  {
    label: 'October'
  },
  {
    label: 'November'
  },
  {
    label: 'December'
  }
]
