import * as fs from 'fs';
import * as path from 'path';
import * as rimraf from 'rimraf';
import { promisify } from 'util';
import * as ncp from 'ncp';
import * as writeFileAtomic from 'write-file-atomic';

export const readFilep = promisify(fs.readFile);
export const rimrafp = promisify(rimraf);
export const writeFileAtomicp = promisify(writeFileAtomic);
export const ncpp = promisify(ncp.ncp);

export interface Bag<T> {
  [script: string]: T;
}

export interface DefaultPackage extends Bag<string> {
  mwts: string;
  typescript: string;
  '@types/node': string;
}

export async function readJsonp(jsonPath: string) {
  const contents = await readFilep(jsonPath, { encoding: 'utf8' });
  return JSON.parse(contents);
}

export interface ReadFileP {
  (path: string, encoding: string): Promise<string>;
}

export function nop() {
  /* empty */
}

/**
 * Recursively iterate through the dependency chain until we reach the end of
 * the dependency chain or encounter a circular reference
 * @param filePath Filepath of file currently being read
 * @param customReadFilep The file reading function being used
 * @param readFiles an array of the previously read files so we can check for
 * circular references
 * returns a ConfigFile object containing the data from all the dependencies
 */
async function getBase(
  filePath: string,
  customReadFilep: ReadFileP,
  readFiles: Set<string>,
  currentDir: string
): Promise<ConfigFile> {
  customReadFilep = customReadFilep || readFilep;

  filePath = path.resolve(currentDir, filePath);

  // An error is thrown if there is a circular reference as specified by the
  // TypeScript doc
  if (readFiles.has(filePath)) {
    throw new Error(`Circular reference in ${filePath}`);
  }
  readFiles.add(filePath);
  try {
    const json = await customReadFilep(filePath, 'utf8');
    let contents = JSON.parse(json);

    if (contents.extends) {
      const nextFile = await getBase(
        contents.extends,
        customReadFilep,
        readFiles,
        path.dirname(filePath)
      );
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      contents = combineTSConfig(nextFile, contents);
    }

    return contents;
  } catch (err) {
    throw new Error(`${filePath} Not Found`);
  }
}

/**
 * Takes in 2 config files
 * @param base is loaded first
 * @param inherited is then loaded and overwrites base
 */
function combineTSConfig(base: ConfigFile, inherited: ConfigFile): ConfigFile {
  const result: ConfigFile = { compilerOptions: {} };

  Object.assign(result, base, inherited);
  Object.assign(
    result.compilerOptions,
    base.compilerOptions,
    inherited.compilerOptions
  );
  delete result.extends;
  return result;
}

/**
 * An interface containing the top level data fields present in Config Files
 */
export interface ConfigFile {
  files?: string[];
  compilerOptions?: {};
  include?: string[];
  exclude?: string[];
  extends?: string[];
}

/**
 * Automatically defines npm or yarn is going to be used:
 * - If only yarn.lock exists, use yarn
 * - If only package-lock.json or both exist, use npm
 */
export function isYarnUsed(existsSync = fs.existsSync): boolean {
  if (existsSync('package-lock.json')) {
    return false;
  }
  return existsSync('yarn.lock');
}

export function getPkgManagerCommand(isYarnUsed?: boolean): string {
  return (
    (isYarnUsed ? 'yarn' : 'npm') + (process.platform === 'win32' ? '.cmd' : '')
  );
}

/**
 * Find the tsconfig.json, read it, and return parsed contents.
 * @param rootDir Directory where the tsconfig.json should be found.
 * If the tsconfig.json file has an "extends" field hop down the dependency tree
 * until it ends or a circular reference is found in which case an error will be
 * thrown
 */
export async function getTSConfig(
  rootDir: string,
  customReadFilep?: ReadFileP
): Promise<ConfigFile> {
  customReadFilep = customReadFilep || readFilep;
  const readArr = new Set<string>();
  return getBase('tsconfig.json', customReadFilep, readArr, rootDir);
}

export function readJSON(filepath: string) {
  const content = fs.readFileSync(filepath, 'utf8');
  try {
    return JSON.parse(content);
  } catch (e) {
    throw new Error(`Failed to parse JSON file '${content}' for: ${e.message}`);
  }
}
