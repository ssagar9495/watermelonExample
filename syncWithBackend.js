//sync with backend on every db action
DBHandler.db
  .withChangesForTables(['accounts', 'transactions'])
  .pipe(
    skip(1),
    filter(changes => !changes.every(change => change.record.syncStatus === 'synced')),
    debounceTime(500)
  )
  .subscribe({
    next: () => synchronizeDB(),
    error: e => console.log(e)
  })
