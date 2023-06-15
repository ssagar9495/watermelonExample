import { synchronize } from '@nozbe/watermelondb/sync'
import DBHandler from '..'
import { toast } from 'react-toastify'
import { adminAPIs } from 'src/api/endPoints'
import { pullApi, pushApi } from 'src/api/admin'

export default async () => {
  try {
    await synchronize({
      database: DBHandler.db,
      pullChanges: async ({ lastPulledAt, schemaVersion, migration }) => {
        return pullApi(adminAPIs.PULL, {
          last_pulled_at: lastPulledAt || '',
          schema_version: schemaVersion,
          migration: encodeURIComponent(JSON.stringify(migration))
        })
          .then(res => {
            return { timestamp: res?.data?.timestamp, changes: res?.data?.data }
          })
          .catch(err => console.log(err))
      },
      pushChanges: async ({ changes, lastPulledAt }) => {
        pushApi(adminAPIs.PUSH, changes, { last_pulled_at: lastPulledAt })
          .then(res => console.log(res))
          .catch(err => console.log(err))
      },

      migrationsEnabledAtVersion: 1
    })
  } catch (err) {
    console.log({ err })
  } finally {
    console.log('Success')
  }

  // const response = await fetch(`http://13.234.167.240:8000/v1/pull?${urlParams}`, {
  //   headers: { authorization: `bearer ${state?.auth?.token}` }
  // })
  // if (!response.ok) {
  //   throw new Error(await response.text())
  // }
  // const { timestamp, data } = await response.json()
}

// const response = await fetch(`http://13.234.167.240:8000/v1/push?last_pulled_at=${lastPulledAt}`, {
//   method: 'POST',
//   body: JSON.stringify(changes),
//   headers: {
//     'Content-Type': 'application/json',
//     Accept: 'application/json',
//     authorization: `bearer ${state?.auth?.token}`
//   }
// })
// if (!response.ok) {
//   throw new Error(await response.text())
// }
