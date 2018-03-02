import * as fs from 'fs-extra';
const drafter = require('drafter.js');
const camelCase = require('camelcase');
const decamelize = require('decamelize');

const RESOURCE_GROUP = 'resourceGroup';
const RESOURCE = 'resource';
const TRANSITION = 'transition';
const CATEGORY = 'category';
const META = 'meta';
const HTTPREQUEST = 'httpRequest';
const CLASSES = 'classes';
const SEMICOLON = ';';

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
  const URL_PROP_NAME_PREFIX = 'URL_';
  const FILE_EXT = '.ts';
  const EOF = '\n';
  const TAB3 = '      ';
  const REQUEST_TYPE_SUFIX = 'Request';

  fs.mkdirpSync(config.outDir.path);
  fs.mkdirpSync(config.outDir.path + '/' + config.outDir.dirNameServices);
  fs.mkdirpSync(config.outDir.path + '/' + config.outDir.dirNameTypes);

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
    const groupName = camelCase(getTitle(item));
    const serviceFileName = decamelize(groupName + config.fileName.sufix, '-');

    // DIR
    fs.mkdirpSync(config.outDir.path + '/' + config.outDir.dirNameTypes + '/' + decamelize(groupName, '-'));

    console.log('*******************');
    console.log(getTitle(item));
    console.log('*******************');
    // console.log(JSON.stringify(item));

    recurse(item, [{name: 'element', value: TRANSITION}], null, result2);
    result2.values.forEach((item2) => {

      // console.log(JSON.stringify(item2));

      const unitName: string = camelCase(getTitle(item2));
      const unitNameRequest: string = camelCase(getTitle(item2) + REQUEST_TYPE_SUFIX);
      const url: string = getHref(item2);
      const unitNameFirstUpper: string = firstUp(unitName);
      const unitNameRequestFirstUpper: string = firstUp(unitNameRequest);
      const contentType = '';
      const typeFileName = decamelize(unitName, '-');
      const typeRequestFileName = decamelize(unitNameRequest, '-');
      const endOfMethod = config.endOfMethod ? config.endOfMethod.join(EOF + TAB3) : null;
      const methodType = getHttpMethod(item2);

      // IMPORTS
      classImports += templateClassImport
        .replace(/@@METHOD_NAME_FIRST_UP@@/g, unitNameFirstUpper)
        .replace(/@@DIR_NAME@@/g, decamelize(groupName, '-'))
        .replace(/@@TYPES_DIR_NAME@@/g, config.outDir.dirNameTypes)
        .replace(/@@FILE_NAME@@/g, typeFileName);

      // IMPORTS REQUEST FILE
      classImports += templateClassImport
        .replace(/@@METHOD_NAME_FIRST_UP@@/g, unitNameRequestFirstUpper)
        .replace(/@@DIR_NAME@@/g, decamelize(groupName, '-'))
        .replace(/@@TYPES_DIR_NAME@@/g, config.outDir.dirNameTypes)
        .replace(/@@FILE_NAME@@/g, typeRequestFileName);

      // METHODS
      methods += EOF + templateHttpMethod
        .replace(/@@METHOD_NAME@@/g, unitNameFirstUpper)
        .replace(/@@URL_PROP_NAME@@/g, URL_PROP_NAME_PREFIX + decamelize(unitName).toUpperCase())
        .replace(/@@METHOD_TYPE@@/g, methodType)
        .replace(/@@END_OF_METHOD@@/g, EOF + TAB3 + endOfMethod || SEMICOLON)
        .replace(/@@METHOD_NAME_FIRST_UP@@/g, firstUp(unitName))
        .replace(/@@HTTP_METHOD@@/g, methodType.toLowerCase())
        .replace(/@@REQUEST_TYPE_SUFIX@@/g, REQUEST_TYPE_SUFIX)
        .replace(/@@HTTP_METHOD_PREFIX@@/g, config.method.addMethodTypeToPrefixName ? firstUp(methodType) : '');

      urlConsts += templateUrlConsts
        .replace(/@@URL_PROP_NAME@@/g, URL_PROP_NAME_PREFIX + decamelize(unitName).toUpperCase())
        .replace(/@@URL@@/g, url);

      // CREATE TYPE
      fs.writeFileSync( config.outDir.path + '/' + config.outDir.dirNameTypes + '/' + decamelize(groupName, '-') + '/' +
        typeFileName + FILE_EXT, contentType, 'utf8');
      fs.writeFileSync( config.outDir.path + '/' + config.outDir.dirNameTypes + '/' + decamelize(groupName, '-') + '/' +
        typeFileName + REQUEST_TYPE_SUFIX + FILE_EXT, contentType, 'utf8');

      console.log(groupName);
      console.log(getHref(item2));
    });

    // IMPORTS
    if (config.imports.length > 0) {
      config.imports.forEach((imp) => {
        classImports += imp;
      });
    }

    contentService +=
      templateService
        .replace(/@@HTTP_METHOD@@/g, methods)
        .replace(/@@CLASS_NAME@@/g, firstUp(groupName))
        .replace(/@@URL_CONSTS@@/g, urlConsts)
        .replace(/@@IMPORTS@@/g, classImports)
      + EOF;

    // CREATE SERVICE
    fs.writeFileSync( config.outDir.path + '/' + config.outDir.dirNameServices + '/' + serviceFileName, contentService, 'utf8');

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

function firstUp(value: string): string {
  return (value.split('').map((char, i) => i === 0 ? char.toUpperCase() : char).join(''));
}

function getHttpMethod(node: any): string {
  const resultHttpRequest: Result = {values: []};
  recurse(node, [{name: 'element', value: HTTPREQUEST}], null, resultHttpRequest);
  console.log(JSON.stringify(resultHttpRequest.values[0]));
  return resultHttpRequest.values[0] &&
    resultHttpRequest.values[0].attributes &&
    resultHttpRequest.values[0].attributes.method ? resultHttpRequest.values[0].attributes.method.content : '';
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
    dirNameServices: string,
    dirNameTypes: string
  };
  fileName: {
    sufix: string
  };
  method: {
    addMethodTypeToPrefixName: boolean
  };
  imports: string[];
  endOfMethod: string[];
}
