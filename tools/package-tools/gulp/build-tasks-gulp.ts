import {dest, src, task} from 'gulp';
import {join} from 'path';
import {main as tsc} from '@angular/tsc-wrapped';
import {buildConfig} from '../build-config';
import {composeRelease} from '../build-release';
import {buildAllSecondaryEntryPointBundles, buildPrimaryEntryPointBundles} from '../build-bundles';
import {inlineResourcesForDirectory} from '../inline-resources';
import {buildScssTask} from './build-scss-task';
import {sequenceTask} from './sequence-task';
import {watchFiles} from './watch-files';
import {getSecondaryEntryPointsForPackage} from '../secondary-entry-points';

// There are no type definitions available for these imports.
const htmlmin = require('gulp-htmlmin');

const {packagesDir, outputDir} = buildConfig;

const htmlMinifierOptions = {
  collapseWhitespace: true,
  removeComments: true,
  caseSensitive: true,
  removeAttributeQuotes: false
};

/**
 * Creates a set of gulp tasks that can build the specified package.
 * @param packageName Name of the package. Needs to be similar to the directory name in `src/`.
 * @param dependencies Required packages that will be built before building the current package.
 * @param options Options that can be passed to adjust the gulp package tasks.
 */
export function createPackageBuildTasks(packageName: string, dependencies: string[] = [],
                                        options: PackageTaskOptions = {}) {

  // To avoid refactoring of the project the package material will map to the source path `lib/`.
  const packageRoot = join(packagesDir, packageName === 'material' ? 'lib' : packageName);
  const packageOut = join(outputDir, 'packages', packageName);

  const tsconfigBuild = join(packageRoot, 'tsconfig-build.json');
  const tsconfigTests = join(packageRoot, 'tsconfig-tests.json');

  // Paths to the different output files and directories.
  const esmMainFile = join(packageOut, 'index.js');

  // Glob that matches all style files that need to be copied to the package output.
  const stylesGlob = join(packageRoot, '**/*.+(scss|css)');

  // Glob that matches every HTML file in the current package.
  const htmlGlob = join(packageRoot, '**/*.html');

  // List of watch tasks that need run together with the watch task of the current package.
  const dependentWatchTasks = dependencies.map(pkgName => `${pkgName}:watch`);

  /**
   * Main tasks for the package building. Tasks execute the different sub-tasks in the correct
   * order.
   */
  task(`${packageName}:clean-build`, sequenceTask('clean', `${packageName}:build`));

  task(`${packageName}:build`, sequenceTask(
    // Build all required packages before building.
    ...dependencies.map(pkgName => `${pkgName}:build`),
    // Build ESM and assets output.
    [`${packageName}:build:esm`, `${packageName}:assets`],
    // Inline assets into ESM output.
    `${packageName}:assets:inline`,
    // Build bundles on top of inlined ESM output.
    `${packageName}:build:bundles`,
  ));

  task(`${packageName}:build-tests`, sequenceTask(
    // Build all required tests before building.
    ...dependencies.map(pkgName => `${pkgName}:build-tests`),
    // Build the ESM output that includes all test files. Also build assets for the package.
    [`${packageName}:build:esm:tests`, `${packageName}:assets`],
    // Inline assets into ESM output.
    `${packageName}:assets:inline`
  ));

  /**
   * Release tasks for the package. Tasks compose the release output for the package.
   */

  task(`${packageName}:build-release:clean`, sequenceTask('clean', `${packageName}:build-release`));
  task(`${packageName}:build-release`, [`${packageName}:build`], () => {
    return composeRelease(packageName, {useSecondaryEntryPoints: options.useSecondaryEntryPoints});
  });

  /**
   * TypeScript compilation tasks. Tasks are creating ESM, FESM, UMD bundles for releases.
   */

  task(`${packageName}:build:esm`, () => {
    const primaryEntryPointResult = tsc(tsconfigBuild, {basePath: packageRoot});

    if (options.useSecondaryEntryPoints) {
      return Promise.all([
        compileSecondaryEntryPointsEsm(packageName, packageRoot),
        primaryEntryPointResult
      ]);
    }

    return primaryEntryPointResult;
  });
  task(`${packageName}:build:esm:tests`, () => tsc(tsconfigTests, {basePath: packageRoot}));

  task(`${packageName}:build:bundles`, () => {
    const primaryBundlePromise = buildPrimaryEntryPointBundles(esmMainFile, packageName);

    return options.useSecondaryEntryPoints ?
        Promise.all([primaryBundlePromise, buildAllSecondaryEntryPointBundles('cdk')]) :
        primaryBundlePromise;
  });

  /**
   * Asset tasks. Building SASS files and inlining CSS, HTML files into the ESM output.
   */
  task(`${packageName}:assets`, [
    `${packageName}:assets:scss`,
    `${packageName}:assets:copy-styles`,
    `${packageName}:assets:html`
  ]);

  task(`${packageName}:assets:scss`, buildScssTask(packageOut, packageRoot, true));
  task(`${packageName}:assets:copy-styles`, () => {
    return src(stylesGlob).pipe(dest(packageOut));
  });
  task(`${packageName}:assets:html`, () => {
    return src(htmlGlob).pipe(htmlmin(htmlMinifierOptions)).pipe(dest(packageOut));
  });

  task(`${packageName}:assets:inline`, () => inlineResourcesForDirectory(packageOut));

  /**
   * Watch tasks, that will rebuild the package whenever TS, SCSS, or HTML files change.
   */
  task(`${packageName}:watch`, dependentWatchTasks, () => {
    watchFiles(join(packageRoot, '**/*.+(ts|scss|html)'), [`${packageName}:build`]);
  });
}


interface PackageTaskOptions {
  useSecondaryEntryPoints?: boolean;
}

/** Sequentially runs tsc for all secondary entry-points for a package. */
async function compileSecondaryEntryPointsEsm(packageName: string, packageRoot: string) {
  for (const p of getSecondaryEntryPointsForPackage(packageName)) {
    await tsc(join(packageRoot, p, 'tsconfig-build.json'), {basePath: join(packageRoot, p)});
  }
}
