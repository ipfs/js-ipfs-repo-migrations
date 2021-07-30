import type { Datastore } from 'interface-datastore'
import type { Blockstore } from 'interface-blockstore'

export interface ProgressCallback {
  (version: number, progress: string, message: string): void
}

export interface MigrationProgressCallback {
  (percent: number, message: string): void
}

export interface Migration {
  version: number
  description: string
  migrate: (backends: Backends, onProgress: MigrationProgressCallback) => Promise<void>
  revert: (backends: Backends, onProgress: MigrationProgressCallback) => Promise<void>
}

export interface Backends {
  root: Datastore
  blocks: Blockstore
  keys: Datastore
  datastore: Datastore
  pins: Datastore
}

export interface LockCloser {
  close: () => Promise<void>
}

export interface RepoLock {
  /**
   * Sets the lock if one does not already exist. If a lock already exists, should throw an error.
   */
  lock: (path: string) => Promise<LockCloser>

  /**
   * Checks the existence of the lock.
   */
  locked: (path: string) => Promise<boolean>
}

export interface RepoOptions {
  /**
   * Controls automatic migrations of repository. (defaults: true)
   */
  autoMigrate: boolean
  /**
   * Callback function to be notified of migration progress
   */
  onMigrationProgress: (version: number, percentComplete: string, message: string) => void

  /**
   * If multiple processes are accessing the same repo - e.g. via node cluster or browser UI and webworkers
   * one instance must be designated the repo owner to hold the lock on shared resources like the datastore.
   *
   * Set this property to true on one instance only if this is how your application is set up.
   */
  repoOwner: boolean

  /**
   * A lock implementation that prevents multiple processes accessing the same repo
   */
  repoLock: RepoLock
}
