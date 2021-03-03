
export type ProgressCallback = (version: number, progress: string, message: string) => void

export type MigrationProgressCallback = (percent: number, message: string) => void

export interface Migration {
  version: number
  description: string
  migrate: (repoPath: string, repoOptions: any, onProgress: MigrationProgressCallback) => Promise<void>,
  revert: (repoPath: string, repoOptions: any, onProgress: MigrationProgressCallback) => Promise<void>
}
