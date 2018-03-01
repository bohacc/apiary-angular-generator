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
  // console.log(fileFormat);
  // console.log(drafter);
  drafter.parse(fileFormat, {generateSourceMap: true}, (err, res) => {
    if (err) {
      console.log(err);
    }
    // console.log(res);
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
      // console.log();
    }
  }
}

function getResourceGroup(content) {
  const result: Result = {values: []};
  const config: Config = JSON.parse(String(fs.readFileSync('apiary.conf.json')));
  fs.mkdirpSync(config.outDir.path);
  fs.mkdirpSync(config.outDir.services);
  fs.mkdirpSync(config.outDir.types);

  recurse(content, [{name: 'element', value: CATEGORY}], RESOURCE_GROUP, result);
  console.log(result);

  result.values.forEach((item) => {
    const result2: Result = {values: []};
    const templateService: string = String(fs.readFileSync('src/templates/api-service.ts'));
    const templateHttpMethod: string = String(fs.readFileSync('src/templates/http-method.ts'));
    const templateClassImport: string = String(fs.readFileSync('src/templates/class-import.ts'));
    const templateUrlConsts: string = String(fs.readFileSync('src/templates/url-consts.ts'));
    let contentService = '';
    let methods = '';
    let classImports = '';
    let urlConsts = '';
    const groupName = (getTitle(item).replace(/ /g, '-'));

    console.log('*******************');
    console.log(getTitle(item));
    console.log('*******************');

    recurse(item, [{name: 'element', value: RESOURCE}], null, result2);
    result2.values.forEach((item2) => {

      console.log(JSON.stringify(item2));

      // const unitName = getFileName(getTitle(item2)).replace(/ /g, '-');
      const unitName = camelize(getFileName(getTitle(item2)));
      const url = getHref(item2);
      const unitNameFirstUpper = (unitName.split('').map((char, i) => i === 0 ? char.toUpperCase() : char).join(''));

      // DIR
      fs.mkdirpSync(config.outDir.types + '/' + groupName.toLowerCase());

      // IMPORTS
      classImports += templateClassImport
        .replace(/@@METHOD_NAME@@/g, unitNameFirstUpper)
        .replace(/@@DIR_NAME@@/g, unitName.toLowerCase())
        .replace(/@@FILE_NAME@@/g, unitName);

      // GET
      methods += '\n' + templateHttpMethod
        .replace(/@@METHOD_NAME@@/g, unitNameFirstUpper)
        .replace(/@@URL_PROP_NAME@@/g, 'URL_' + unitName.toUpperCase())
        .replace(/@@METHOD_TYPE@@/g, 'get')
        .replace(/@@METHOD_TYPE_UPPER@@/g, 'Get');

      urlConsts += templateUrlConsts
        .replace(/@@URL_PROP_NAME@@/g, 'URL_' + unitName.toUpperCase())
        .replace(/@@URL@@/g, url);

      // POST

      // PUT

      // DELETE

      console.log(groupName);
      console.log(getHref(item2));
    });

    contentService +=
      templateService
        .replace(/@@HTTP_METHOD@@/g, methods)
        .replace(/@@CLASS_NAME@@/g, groupName)
        .replace(/@@URL_CONSTS@@/g, urlConsts)
        .replace(/@@IMPORTS@@/g, classImports)
      + '\n';

    // CREATE SERVICE
    fs.writeFileSync( config.outDir.services + '/' +
      groupName.toLowerCase() + config.fileName.sufix, contentService, 'utf8');

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

function getFileName(str: string): string {
  return str.toLowerCase().replace(/ /g, '-');
}

function camelize(str) {
  return str.replace(/(?:^\w|[A-Z]|\b\w|\s+)/g, function(match, index) {
    if (+match === 0) { return ''; } // or if (/\s+/.test(match)) for white spaces
    return index === 0 ? match.toLowerCase() : match.toUpperCase();
  });
}

interface Node {
  name: string;
  value: string;
}

interface Result {
  values: any[];
}

interface Config {
  outDir: {
    path: string,
    services: string,
    types: string
  };
  fileName: {
    sufix: string
  };
}
