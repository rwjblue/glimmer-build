"use strict";

const typescript = require('broccoli-typescript-compiler').typescript;
const mergeTrees = require('broccoli-merge-trees');
const assert = require('assert');
const funnel = require('broccoli-funnel');
const concat = require('broccoli-concat');
const fs = require('fs');
const replace = require('broccoli-string-replace');
const writeFile = require('broccoli-file-creator');
const funnelLib = require('./lib/funnel-lib');
const getPackageName = require('./lib/get-package-name');
const toNamedAMD = require('./lib/to-named-amd');
const toES5 = require('./lib/to-es5');
const helpers = require('./lib/generate-helpers');

module.exports = function(options) {
  options = options || {};

  let env = process.env.BROCCOLI_ENV;
  let projectPath = process.cwd();
  let projectName = getPackageName(projectPath);

  console.log('Build project:', projectName);
  console.log('Build env:', env);
  console.log('Build path:', projectPath);

  let trees = [];

  let tsinclude = [
    'src/**'
  ];

  if (env === 'tests') {
    tsinclude.push('test/**');
    tsinclude.push('node_modules/@types/**');

    trees.push(funnelLib('loader.js', {
      include: ['loader.js'],
      destDir: '',
      annotation: 'loader.js'
    }));

    trees.push(funnelLib('qunitjs', {
      include: ['qunit.js', 'qunit.css'],
      destDir: '',
      annotation: 'test/qunit.{js|css}'
    }));

    trees.push(funnel('../../test-support', {
      include: ['*.js', '*.html'],
      destDir: '',
      annotation: 'test-support'
    }));

    trees.push(concat('../../', {
      inputFiles: [
        'node_modules/glimmer-engine/dist/amd/glimmer-common.amd.js',
        'node_modules/glimmer-engine/dist/amd/glimmer-compiler.amd.js',
        'node_modules/glimmer-engine/dist/amd/glimmer-runtime.amd.js'
      ],
      outputFile: 'vendor.js'
    }));

    let babelHelpers = writeFile('babel-helpers.js', helpers('amd'));
    trees.push(babelHelpers);

    let testDependencies = options.testDependencies;
    if (testDependencies) {
      trees.push(concat('./', {
        inputFiles: testDependencies,
        outputFile: 'test-dependencies.js'
      }));
    } else {
      trees.push(writeFile('test-dependencies.js', ''));
    }

    trees.push(compileTS('tsconfig.tests.json', projectPath, tsinclude));

  } else {
    let es2015 = compileTS('tsconfig.json', projectPath, tsinclude);
    trees.push(es2015);

    let es5 = toES5(es2015, {
      sourceMap: 'inline'
    });

    let namedAMD = toNamedAMD(es5);
    trees.push(namedAMD);

    let amd = concat(namedAMD, {
      inputFiles: ['**/*.js'],
      outputFile: 'amd/' + projectName + '.js'
    });

    trees.push(amd);
  }

  return mergeTrees(trees);
};

function compileTS(tsconfigFile, projectPath, tsinclude) {
  let tsconfig = JSON.parse(fs.readFileSync(tsconfigFile));

  if (tsconfig.compilerOptions.outFile) {
    tsconfig.compilerOptions.outFile = removeFirstPathSegment(tsconfig.compilerOptions.outFile);
  }

  if (tsconfig.compilerOptions.outDir) {
    tsconfig.compilerOptions.outDir = removeFirstPathSegment(tsconfig.compilerOptions.outDir);
  }

  let ts = funnel(projectPath, {
    include: tsinclude,
    annotation: 'raw source'
  });

  return typescript(ts, {
    tsconfig,
    annotation: 'compiled source'
  });
}

function removeFirstPathSegment(path) {
  let parts = path.split('\/');
  parts.shift();
  return parts.join('\/');
}
