#!/usr/bin/env node
const argv = require('yargs')
  .usage('Usage: $0 --from type:value --to type:value <file>')
  .describe('from', '"type:value" - type can be one of id, class, tag')
  .describe('to', '"type:value" - type can be one of id, class, tag')
  .demandOption(['from', 'to'])
  .boolean('remove')
  .alias('R', 'remove')
  .describe('remove', 'Remove --from selector rather than replace')
  .boolean('scss')
  .alias('s', 'scss')
  .describe('scss', 'Parse CSS as SCSS')
  .boolean('w')
  .alias('w', 'write')
  .describe('w', 'Write changes')
  .demandCommand(1)
  .argv;
const fs = require('fs');
const chalk = require('chalk');
const log = console.log; // eslint-disable-line no-console
const parser = require('postcss-selector-parser');
const path = require('path');
const postcss = require('postcss');
const syntax = require('postcss-scss');
const processor = parser();
const source = path.resolve(argv._[0]);
const [fromType, fromValue] = argv.from ? splitOption(argv.from) : [];
const [toType, toValue] = argv.to ? splitOption(argv.to) : [];
const validTypes = new Set(['tag', 'class', 'id']);

if (!validTypes.has(fromType)) {
  console.error('option --from has invalid type, should be one of [id, class, tag]');
  process.exit(1);
}

if (!validTypes.has(toType)) {
  console.error('option --to has invalid type, should be one of [id, class, tag]');
  process.exit(1);
}


if (!fs.existsSync(source)) {
  log(`File at ${source} does not exist!`);
  process.exit(1);
}

const replacingNode = createReplacementNode(toType, toValue);

const processRule = (rule, type, value, replacingNode) => {
  const ast = processor.astSync(rule, {lossless: true, updateSelector: true});

  ast.walk(node => {
    if (node.type === type && node.value === value) {
      if (argv.remove) {
        node.remove();
      } else {
        node.replaceWith(replacingNode);
      }
    }
  });

  return ast.toString();
};

const search = postcss.plugin('postcss-search-and-replace', (options) => {

  const {
    fromType,
    fromValue,
    replacingNode,
  } = options || {};

  return (root) => {
    root.walkRules(rule => {
      rule.selector = processRule(rule, fromType, fromValue, replacingNode);
    });
  };
});

let processOptions = {
  from: source
};

if (argv.scss) {
  processOptions.parser = syntax;
}

if (replacingNode) {
  fs.readFile(source, (err, css) => {
    postcss([search({
      fromType,
      fromValue,
      replacingNode
    })])
      .process(css, processOptions)
      .then((result) => {
        if (argv.w) {
          fs.writeFile(source, result.css, (err) => {
            if (err) throw err;
            log(chalk`✨ Writing {green ${source}}.`);
          });
        } else {
          log(chalk`{blue ${source}}`);
          log(result.css);
        }
      })
      .catch(error => {
        if (error) throw error;
      });
  });
}

function createReplacementNode(type, value) {
  switch (type) {
  case 'id':
    return parser.id({value});
  case 'tag':
    return parser.tag({value});
  case 'class':
    return parser.className({value});
  default:
    return undefined;
  }
}

function splitOption(opt) {
  return opt.split(':');
}
