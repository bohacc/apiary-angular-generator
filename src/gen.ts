import * as fs from 'fs-extra';
const drafter = require('drafter.js');

const RESOURCE_GROUP = 'resourceGroup';
const RESOURCE = 'resource';
const CATEGORY = 'category';
const META = 'meta';
const CLASSES = 'classes';

export function gen() {
  const file = fs.readFileSync('./schema/apiary.txt', 'utf8');
  const fileFormat = String(file).replace(/\r?\n|\r/g, '\n');
  console.log(fileFormat);
  console.log(drafter);
  drafter.parse(fileFormat, {generateSourceMap: true}, (err, res) => {
    if (err) {
      console.log(err);
    }
    console.log(res);
    // this.content = res;
    getResourceGroup(res);
  });
}

function recurse(content: any, nodes: Node[], meta: string, result: Result) {
  if (Array.isArray(content)) {
    content.forEach((item) => {
      recurse(item, nodes, meta, result);
    });
  } else {
    if (typeof content === 'object' && content !== null) {
      if (existNodes(content, nodes) &&
        ((meta && content[META] && content[META][CLASSES] && content[META][CLASSES][0] === meta) || !meta)
      ) {
        result.values.push(content);
      } else {
        for (const key in content) {
          if (!content.hasOwnProperty(key)) {
            continue;
          }
          recurse(content[key], nodes, meta, result);
        }
      }
    } else {
      console.log();
    }
  }
}

function getResourceGroup(content) {
  const result: Result = {values: []};
  recurse(content, [{name: 'element', value: CATEGORY}], RESOURCE_GROUP, result);
  console.log(result);

  result.values.forEach((item) => {
    const result2: Result = {values: []};
    console.log('*******************');
    console.log(getTitle(item));
    console.log('*******************');
    // console.log(result2);
    recurse(item, [{name: 'element', value: RESOURCE}], null, result2);
    result2.values.forEach((item2) => {
      const title = getTitle(item2);
      fs.writeFileSync(title + '.ts', 'xxx', 'utf8');
      console.log(title);
      console.log(getHref(item2));
    });
    console.log('/////////////////////////');
  });
}

function getTitle(node: any): string {
  return node && node.meta && node.meta.title ? node.meta.title.content : null;
}

function getHref(node: any): string {
  return node && node.attributes && node.attributes.href ? node.attributes.href.content : null;
}

function existNodes(obj: any, nodes: Node[]): boolean {
  let find = 0;
  if (obj) {
    nodes.forEach((node: Node) => {
      if (obj[node.name] === node.value) {
        find += 1;
      }
    });
  }
  return find === nodes.length;
}

interface Node {
  name: string;
  value: string;
}

interface Result {
  values: any[];
}
