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
const HREF_VARIABLES = 'hrefVariables';
const CLASSES = 'classes';
const SEMICOLON = ';';
const URL_QUERY_PARAMS_PREFIX = '{?';
const URL_PARAMS_PREFIX = '{';
const URL_PARAMS_SUFIX = '}';
const REQUIRED = 'required';
const NO_REQUIRED_CHAR = '?';
const URL_PROP_NAME_PREFIX = 'URL_';
const FILE_EXT = '.ts';
const EOF = '\n';
const TAB6 = '      ';
const TAB4 = '    ';
const TAB2 = '  ';
const TAB1 = ' ';
const REQUEST_TYPE_SUFIX = 'Request';
const METHOD_PARAM_NAME = 'request';
const METHOD_PARAM_NAME_FOR_BODY = 'requestBody';
const METHOD_PARAM_NAME_FOR_QUERY = 'requestQuery';

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
  fs.mkdirpSync(config.outDir.path + '/' + config.outDir.dirNameServices);
  fs.mkdirpSync(config.outDir.path + '/' + config.outDir.dirNameTypes);

  recurse(content, [{name: 'element', value: CATEGORY}], RESOURCE_GROUP, result);
  // console.log(result);

  result.values.forEach((groupNode) => {
    const result2: Result = {values: []};
    const templateService: string = String(fs.readFileSync('src/templates/api-service.ts'));
    const templateHttpMethod: string = String(fs.readFileSync('src/templates/http-method.ts'));
    const templateClassImport: string = String(fs.readFileSync('src/templates/class-import.ts'));
    const templateUrlConsts: string = String(fs.readFileSync('src/templates/url-consts.ts'));
    const templateParamsReplace: string = String(fs.readFileSync('src/templates/http-method-params-replace.ts'));
    const templateConvertQueryParams: string = String(fs.readFileSync('src/templates/http-method-convert-to-query-params.ts'));
    let contentService = '';
    let methods = '';
    let classImports = '';
    let urlConsts = '';
    const groupTitle = getTitle(groupNode);
    const groupName = camelCase(groupTitle);
    const serviceFileName = decamelize(groupName + config.fileName.sufix, '-');

    // DIR
    fs.mkdirpSync(config.outDir.path + '/' + config.outDir.dirNameTypes + '/' + decamelize(groupName, '-'));

    console.log('*******************');
    console.log(getTitle(groupNode));
    console.log('*******************');
    // console.log(JSON.stringify(groupNode));

    recurse(groupNode, [{name: 'element', value: RESOURCE}], null, result2);
    result2.values.forEach((subGroup) => {
      const result3: Result = {values: []};

      // console.log(JSON.stringify(node));

      recurse(subGroup, [{name: 'element', value: TRANSITION}], null, result3);
      result3.values.forEach((node) => {

        const unitName: string = camelCase(getTitle(node));
        const unitNameRequest: string = camelCase(getTitle(node) + REQUEST_TYPE_SUFIX);
        // console.log(JSON.stringify(subGroup));
        const url = getHref(node) || getHref(subGroup);
        const urlWithoutQueryParams: string = prepareHref(url);
        const unitNameFirstUpper: string = firstUp(unitName);
        const unitNameRequestFirstUpper: string = firstUp(unitNameRequest);
        const typeFileName = decamelize(unitName, '-') + FILE_EXT;
        const typeRequestFileName = decamelize(unitNameRequest, '-');
        const endOfMethod = config.endOfMethod ? config.endOfMethod.join(EOF + TAB6) : null;
        const methodType = getHttpMethod(node);
        const hrefVariables: Param[] = getHrefVariables(node);
        const bodyVariables: Param[] = getBodyVariables(node);
        const urlParams: string[] = getParamsFromUrl(url);
        const urlQueryParams: string[] = getQueryParamsFromUrl(url);
        const secondParam = getHttpMethodSecondParam(methodType, urlQueryParams, bodyVariables);
        const thirdParam = getHttpMethodThirdParam(methodType, urlQueryParams, bodyVariables);
        let convertQueryParams = '';
        let replaceParams = '';

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

        /// PARAMS
        if (urlParams) {
          // console.log(urlParams);
          urlParams.forEach((param) => {
            replaceParams += EOF + TAB6 + templateParamsReplace
              .replace(/\r?\n|\r/g, '')
              .replace(/@@PARAM@@/g, param)
              .replace(/@@VALUE@@/g, param);
          });
        }

        /// QUERY PARAMS

        if (urlQueryParams && urlQueryParams.length > 0) {
          console.log(JSON.stringify(urlQueryParams));
          convertQueryParams = EOF + TAB4 + templateConvertQueryParams
            .replace(/\r?\n|\r/g, '')
            .replace(/@@PARAM_NAME@@/g, METHOD_PARAM_NAME);
        }

        methods += (methods ? EOF : '') + templateHttpMethod
          .replace(/@@METHOD_NAME@@/g, unitNameFirstUpper)
          .replace(/@@URL_PROP_NAME@@/g, URL_PROP_NAME_PREFIX + decamelize(unitName).toUpperCase())
          .replace(/@@END_OF_METHOD@@/g, EOF + TAB6 + endOfMethod || SEMICOLON)
          .replace(/@@METHOD_NAME_FIRST_UP@@/g, firstUp(unitName))
          .replace(/@@HTTP_METHOD@@/g, methodType.toLowerCase())
          .replace(/@@HTTP_SERVICE_SECOND_PARAM@@/g, secondParam)
          .replace(/@@HTTP_SERVICE_THIRD_PARAM@@/g, thirdParam)
          .replace(/@@CONVERT_TO_QUERY_PARAMS@@/g, convertQueryParams)
          .replace(/@@REPLACE_URL_PARAMS@@/g, replaceParams)
          .replace(/@@METHOD_PARAMS@@/g,
            getMethodParams(firstUp(unitName), node, urlParams, urlQueryParams, hrefVariables, bodyVariables)
          )
          .replace(/@@HTTP_METHOD_PREFIX@@/g, config.method.addMethodTypeToPrefixName ? firstUp(methodType) : '');

        urlConsts += templateUrlConsts
          .replace(/@@URL_PROP_NAME@@/g, URL_PROP_NAME_PREFIX + decamelize(unitName).toUpperCase())
          .replace(/@@URL@@/g, urlWithoutQueryParams);

        // CREATE TYPES
        createTypeRequest(config, unitName, groupName, url, hrefVariables);

        // createTypeResponse(config, unitName, groupName, hrefVariables);

        // TODO: create ENUM

        console.log(groupName);
        console.log(url);
      });
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
  // console.log(JSON.stringify(node));
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
  // console.log(JSON.stringify(resultHttpRequest.values[0]));
  return resultHttpRequest.values[0] &&
    resultHttpRequest.values[0].attributes &&
    resultHttpRequest.values[0].attributes.method ? resultHttpRequest.values[0].attributes.method.content : '';
}

function prepareHref(value:  string): string {
  const pos: number = value ? value.indexOf(URL_QUERY_PARAMS_PREFIX) : -1;
  return value && pos > -1 ? value.substring(0, pos) : value;
}

function getPropertyName(node: any): string {
  return node && node.content && node.content.key && node.content.key.content ? node.content.key.content : '';
}

function getPropertyType(node: any): string {
  return node && node.content && node.content.value && node.content.value.element ? node.content.value.element : '';
}

function getPropertyRequired(node: any): boolean {
  return node && node.attributes && node.attributes.typeAttributes && node.attributes.typeAttributes.indexOf(REQUIRED) > -1;
}

function getMethodParams(unitName, node: any, params: string[], queryParams: string[],
                         hrefVariables: Param[], bodyVariables: Param[]): string {
  const templateMethodParams: string = String(fs.readFileSync('src/templates/http-method-params.ts'));
  const templateMethodRequest: string = String(fs.readFileSync('src/templates/http-method-request.ts'));
  let result = '';
  let paramsString = '';
  let queryParamsString = '';
  let bodyParamsString = '';

  // PARAMS
  if (params && params.length > 0) {
    paramsString = params.map((el, i) => {
      const param: Param = getParam(el, hrefVariables);
      if (param) {
        return (i === 0 ? '' : ',') + param.name + ': ' + param.type;
      } else {
        return '';
      }
    }).join('');

    // QUERY PARAMS
    if (queryParams && queryParams.length > 0) {
      queryParamsString = ',' + TAB1 + templateMethodRequest
        .replace(/\r?\n|\r/g, '')
        .replace(/@@PARAM_NAME@@/g, bodyVariables && bodyVariables.length > 0 ? METHOD_PARAM_NAME_FOR_QUERY : METHOD_PARAM_NAME)
        .replace(/@@METHOD_NAME_FIRST_UP@@/g, firstUp(unitName))
        .replace(/@@REQUEST_TYPE_SUFIX@@/g, REQUEST_TYPE_SUFIX);
    }

    // BODY PARAMS
    if (bodyVariables && bodyVariables.length > 0) {
      bodyParamsString = ',' + TAB1 + templateMethodRequest
        .replace(/\r?\n|\r/g, '')
        .replace(/@@PARAM_NAME@@/g, bodyVariables && bodyVariables.length > 0 ? METHOD_PARAM_NAME_FOR_BODY : METHOD_PARAM_NAME)
        .replace(/@@METHOD_NAME_FIRST_UP@@/g, firstUp(unitName))
        .replace(/@@REQUEST_TYPE_SUFIX@@/g, REQUEST_TYPE_SUFIX);
    }

    result = templateMethodParams
      .replace(/\r?\n|\r/g, '')
      .replace(/@@SIMPLE_PARAMS@@/g, paramsString)
      .replace(/@@REQUEST_PARAMS@@/g, queryParamsString)
      .replace(/@@REQUEST_BODY@@/g, bodyParamsString);
  }

  return result;
}

function getHrefVariables(node: any): Param[] {
  const hrefVariables: Result = {values: []};
  const variables: any[] = [];
  recurse(node, [{name: 'element', value: HREF_VARIABLES}], null, hrefVariables);

  if (hrefVariables.values[0]) {
    hrefVariables.values[0].content.forEach((hrefVariable) => {
      variables.push({
        name: getPropertyName(hrefVariable),
        type: getPropertyType(hrefVariable),
        required: getPropertyRequired(hrefVariable)
      });
    });
  }

  return variables;
}

function getBodyVariables(node: any): Param[] {
  /*const hrefVariables: Result = {values: []};
  const variables: any[] = [];
  recurse(node, [{name: 'element', value: HREF_VARIABLES}], null, hrefVariables);

  if (hrefVariables.values[0]) {
    hrefVariables.values[0].content.forEach((hrefVariable) => {
      variables.push({
        name: getPropertyName(hrefVariable),
        type: getPropertyType(hrefVariable),
        required: getPropertyRequired(hrefVariable)
      });
    });
  }

  return variables;*/
  return [];
}

function createTypeRequest(config: Config, unitName: string, groupName: string, url: string, hrefVariables: Param[]) {
  const templateInterfaceProperty: string = String(fs.readFileSync('src/templates/interface-property.ts'));
  const templateInterface: string = String(fs.readFileSync('src/templates/interface.ts'));
  const typeFileNameRequest = decamelize(unitName + REQUEST_TYPE_SUFIX, '-') + FILE_EXT;
  const paramsFromUrl: string[] = getQueryParamsFromUrl(url);
  let contentTypeRequest: string;
  let properties = '';

  if (hrefVariables) {
    hrefVariables.forEach((param: Param) => {
      if (properties) {
        properties += EOF + TAB2;
      }
      if (paramsFromUrl.indexOf(param.name) > -1) {
        properties += templateInterfaceProperty
          .replace(EOF, '')
          .replace(/@@KEY@@/g, param.name)
          .replace(/@@REQUIRED@@/g, param.required ? '' : NO_REQUIRED_CHAR)
          .replace(/@@VALUE@@/g, param.type);
      }
    });
  }

  if (properties) {
    contentTypeRequest = templateInterface
      .replace(/@@INTERFACE_NAME@@/g, firstUp(unitName) + REQUEST_TYPE_SUFIX)
      .replace(/@@PROPERTIES@@/g, properties);
  }

  /// SAVE TYPE TO FILE
  if (contentTypeRequest) {
    fs.writeFileSync(config.outDir.path + '/' + config.outDir.dirNameTypes + '/' + decamelize(groupName, '-') + '/' +
      typeFileNameRequest, contentTypeRequest, 'utf8');
  }
}

function createTypeResponse(config: Config, unitName: string, groupName: string, hrefVariables: any[]) {
  const templateInterfaceProperty: string = String(fs.readFileSync('src/templates/interface-property.ts'));
  const templateInterface: string = String(fs.readFileSync('src/templates/interface.ts'));
  const typeFileName = decamelize(unitName, '-') + FILE_EXT;
  let contentTypeResponse: string;
  let properties = '';

  if (hrefVariables[0]) {
    hrefVariables[0].content.forEach((hrefVariable) => {
      if (properties) {
        properties += EOF + TAB2;
      }
      properties += templateInterfaceProperty
        .replace(EOF, '')
        .replace(/@@KEY@@/g, getPropertyName(hrefVariable))
        .replace(/@@REQUIRED@@/g, getPropertyRequired(hrefVariable) ? '' : NO_REQUIRED_CHAR)
        .replace(/@@VALUE@@/g, getPropertyType(hrefVariable));
    });
  }

  if (properties) {
    contentTypeResponse = templateInterface
      .replace(/@@INTERFACE_NAME@@/g, firstUp(unitName) + REQUEST_TYPE_SUFIX)
      .replace(/@@PROPERTIES@@/g, properties);
  }

  /// SAVE TYPE TO FILE
  if (contentTypeResponse) {
    fs.writeFileSync(config.outDir.path + '/' + config.outDir.dirNameTypes + '/' + decamelize(groupName, '-') + '/' +
      typeFileName, contentTypeResponse, 'utf8');
  }
}

function getQueryParamsFromUrl(url: string): string[] {
  const posPrefix = url.indexOf(URL_QUERY_PARAMS_PREFIX);
  let params: string[];
  if (posPrefix > -1) {
    const fragment = url.substr(posPrefix + URL_QUERY_PARAMS_PREFIX.length);
    const posSufix = fragment.indexOf(URL_PARAMS_SUFIX);
    params = fragment.substr(0, posSufix)
      .split(',');
  }
  return params || [];
}

function getParamsFromUrl(url: string): string[] {
  const posPrefix: number = url.indexOf(URL_QUERY_PARAMS_PREFIX);
  const fragment: string = posPrefix > -1 ? url.substr(0, posPrefix) : url;
  const params: string[] = [];
  (fragment ? fragment.split(URL_PARAMS_PREFIX) : []).forEach((item) => {
    if (item.indexOf(URL_PARAMS_SUFIX) > -1) {
      params.push(item.split(URL_PARAMS_SUFIX)[0]);
    }
  });
  return params;
}

function getParam(key: string, params: Param[]): Param {
  return params.filter((param) => param.name === key)[0];
}

function getHttpMethodSecondParam(methodType: string, queryParams: string[], bodyParams: Param[]): string {
  let result = ', null';
  const templateParamOption: string = String(fs.readFileSync('src/templates/http-method-param-options.ts'));
  if (['GET', 'DELETE'].indexOf(methodType.toUpperCase()) > -1) {
    if (queryParams && queryParams.length) { // QUERY PARAMS
      result = templateParamOption
        .replace(/\r?\n|\r/g, '');
    }
  } else if (['POST', 'PUT'].indexOf(methodType.toUpperCase()) > -1) {
    if (bodyParams && bodyParams.length) {
      if (queryParams && queryParams.length) {
        result = ', ' + METHOD_PARAM_NAME_FOR_BODY;
      } else {
        result = ', ' + METHOD_PARAM_NAME;
      }
    }
  }

  return result;
}

function getHttpMethodThirdParam(methodType: string, queryParams: string[], bodyParams: Param[]): string {
  let result = '';
  const templateParamOption: string = String(fs.readFileSync('src/templates/http-method-param-options.ts'));
  if (['GET', 'DELETE'].indexOf(methodType.toUpperCase()) > -1) {

  } else if (['POST', 'PUT'].indexOf(methodType.toUpperCase()) > -1) {
    if (queryParams && queryParams.length) {
      result = templateParamOption
        .replace(/\r?\n|\r/g, '');
    }
  }

  return result;
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

interface Param {
  name: string;
  type: TypesEnum;
  required?: boolean;
}

enum TypesEnum {
  STRING = 'string',
  NUMBER = 'number',
  ARRAY = '<T>[]',
  BOOLEAN = 'boolean'
}
