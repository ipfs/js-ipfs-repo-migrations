import { Backends } from '../src/types'


export type SetupFunction = (prefix?: string) => Promise<{ dir: string, backends: Backends}>
export type CleanupFunction = (dir: string) => Promise<void>
