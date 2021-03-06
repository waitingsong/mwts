import chalk = require('chalk');
import * as ts from 'typescript';

import { Options } from './cli';
import { getTSConfig, rimrafp } from './util';

interface TSConfig {
  compilerOptions: ts.CompilerOptions;
}

/**
 * Remove files generated by the build.
 */
export async function clean(options: Options): Promise<boolean> {
  const tsconfig = (await getTSConfig(options.targetRootDir)) as TSConfig;
  if (tsconfig.compilerOptions && tsconfig.compilerOptions.outDir) {
    const outDir = tsconfig.compilerOptions.outDir;
    if (outDir === '.') {
      options.logger.error(
        `${chalk.red('ERROR:')} ${chalk.gray('compilerOptions.outDir')} ` +
          'cannot use the value ".".  That would delete all of our sources.'
      );
      return false;
    }
    const message = `${chalk.red('Removing')} ${outDir} ...`;
    options.logger.log(message);
    await rimrafp(outDir);
    return true;
  } else {
    options.logger.error(
      `${chalk.red('ERROR:')} The ${chalk.gray('clean')} command` +
        ` requires ${chalk.gray('compilerOptions.outDir')} to be defined in ` +
        'tsconfig.json.'
    );
    return false;
  }
}
