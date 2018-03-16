import * as fs from 'fs-extra';
const drafter = require('drafter.js');
const camelCase = require('camelcase');
const decamelize = require('decamelize');

const RESOURCE_GROUP = 'resourceGroup';
const RESOURCE = 'resource';
const TRANSITION = 'transition';
const CATEGORY = 'category';
const META = 'meta';
const HTTP_REQUEST = 'httpRequest';
const HTTP_RESPONSE = 'httpResponse';
const HREF_VARIABLES = 'hrefVariables';
const DATA_STRUCTURE = 'dataStructure';
const DATA_STRUCTURES = 'dataStructures';
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
const COMMA = ',';
const SLASH = '/';
const REQUEST_TYPE_SUFIX = 'Request';
const REQUEST_BODY_TYPE_SUFIX = 'RequestBody';
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
    // console.log(JSON.stringify(res));
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
  // TODO: set default config

  fs.mkdirpSync(config.outDir.path);
  fs.mkdirpSync(config.outDir.path + SLASH + config.outDir.dirNameServices);
  fs.mkdirpSync(config.outDir.path + SLASH + config.outDir.dirNameTypes);

  recurse(content, [{name: 'element', value: CATEGORY}], RESOURCE_GROUP, result);

  // GET DATA STRUCTURES / TYPES
  const dataStructures: any[] = getDataStructures(content);

  // CREATE GLOBAL TYPES
  const structures: Structure[] = getTypes(dataStructures);

  // CREATE TYPE FILES
  createTypeFiles(structures, config);

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
    fs.mkdirpSync(config.outDir.path + SLASH + config.outDir.dirNameTypes + SLASH + decamelize(groupName, '-'));

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
        console.log(JSON.stringify(node));

        const url = getHref(node) || getHref(subGroup);
        const urlWithoutQueryParams: string = prepareHref(url);
        const unitNameFirstUpper: string = firstUp(unitName);
        const typeFileName = decamelize(unitName, '-');
        const endOfMethod = config.endOfMethod ? config.endOfMethod.join(EOF + TAB6) : null;
        const methodType = getHttpMethod(node);
        const hrefVariables: Param[] = getHrefVariables(node, structures);
        const bodyVariables: Param[] = getBodyVariables(node, structures);
        const urlParams: Param[] = getParamsFromUrl(url, hrefVariables);
        const urlQueryParams: Param[] = getQueryParamsFromUrl(url, hrefVariables, config);
        const responseVariables: Param[] = getResponseVariables(node, structures);

        const secondParam = getHttpMethodSecondParam(methodType, urlQueryParams, bodyVariables);
        const thirdParam = getHttpMethodThirdParam(methodType, urlQueryParams, bodyVariables);
        let convertQueryParams = '';
        let replaceParams = '';

        // TOOL FUNCTION
        const addClassImport = (methodName: string, fileName: string) => {
          classImports += templateClassImport
            .replace(/@@METHOD_NAME_FIRST_UP@@/g, methodName)
            .replace(/@@DIR_NAME@@/g, decamelize(groupName, '-'))
            .replace(/@@TYPES_DIR_NAME@@/g, config.outDir.dirNameTypes)
            .replace(/@@FILE_NAME@@/g, fileName);
        };

        // *** METHODS *** //

        /// PARAMS
        if (urlParams) {
          // console.log(urlParams);
          urlParams.forEach((param) => {
            replaceParams += EOF + TAB6 + templateParamsReplace
              .replace(/\r?\n|\r/g, '')
              .replace(/@@PARAM@@/g, param.name)
              .replace(/@@VALUE@@/g, param.name);
          });
        }

        /// QUERY PARAMS

        if (urlQueryParams && urlQueryParams.length > 0) {
          convertQueryParams = EOF + TAB4 + templateConvertQueryParams
            .replace(/\r?\n|\r/g, '')
            .replace(/@@PARAM_NAME@@/g, METHOD_PARAM_NAME);
        }

        methods += (methods ? EOF : '') + templateHttpMethod
          .replace(/@@METHOD_NAME@@/g, unitNameFirstUpper)
          .replace(/@@URL_PROP_NAME@@/g, URL_PROP_NAME_PREFIX + decamelize(unitName).toUpperCase())
          .replace(/@@END_OF_METHOD@@/g, EOF + TAB6 + endOfMethod || SEMICOLON)
          .replace(/@@METHOD_NAME_FIRST_UP@@/g, responseVariables && responseVariables.length ? firstUp(unitName) : TypesEnum.ANY)
          .replace(/@@HTTP_METHOD@@/g, methodType.toLowerCase())
          .replace(/@@HTTP_SERVICE_SECOND_PARAM@@/g, secondParam)
          .replace(/@@HTTP_SERVICE_THIRD_PARAM@@/g, thirdParam)
          .replace(/@@CONVERT_TO_QUERY_PARAMS@@/g, convertQueryParams)
          .replace(/@@REPLACE_URL_PARAMS@@/g, replaceParams)
          .replace(/@@METHOD_PARAMS@@/g,
            getMethodParams(firstUp(unitName), urlParams, urlQueryParams, bodyVariables)
          )
          .replace(/@@HTTP_METHOD_PREFIX@@/g, config.method.addMethodTypeToPrefixName ? firstUp(methodType) : '');

        urlConsts += templateUrlConsts
          .replace(/@@URL_PROP_NAME@@/g, URL_PROP_NAME_PREFIX + decamelize(unitName).toUpperCase())
          .replace(/@@URL@@/g, urlWithoutQueryParams);

        // *** END METHODS *** //




        // CREATE TYPES
        if (urlQueryParams && urlQueryParams.length > 0 && bodyVariables && bodyVariables.length > 0) {
          let name;
          let fileName;
          // IMPORTS REQUEST FILE
          name = firstUp(unitName + REQUEST_TYPE_SUFIX);
          fileName = decamelize(unitName + REQUEST_TYPE_SUFIX, '-');
          addClassImport(name, fileName);

          // CREATE TYPE - QUERY PARAMS
          createTypeRequest(config, unitName + REQUEST_TYPE_SUFIX, groupName, url, urlQueryParams);

          // IMPORTS REQUEST FILE
          name = firstUp(unitName + REQUEST_TYPE_SUFIX);
          fileName = decamelize(unitName + REQUEST_TYPE_SUFIX, '-');
          addClassImport(name, fileName);

          // CREATE TYPE - BODY PARAMS
          createTypeRequest(config, unitName + REQUEST_BODY_TYPE_SUFIX, groupName, url, bodyVariables);

        } else if (urlQueryParams && urlQueryParams.length > 0) {
          let name;
          let fileName;

          // IMPORTS REQUEST FILE
          name = firstUp(unitName + REQUEST_TYPE_SUFIX);
          fileName = decamelize(unitName + REQUEST_TYPE_SUFIX, '-');
          addClassImport(name, fileName);

          // CREATE TYPE - QUERY PARAMS
          createTypeRequest(config, unitName + REQUEST_TYPE_SUFIX, groupName, url, urlQueryParams);

        } else if (bodyVariables && bodyVariables.length > 0) {
          let name;
          let fileName;

          // IMPORTS REQUEST FILE
          name = firstUp(unitName + REQUEST_TYPE_SUFIX);
          fileName = decamelize(unitName + REQUEST_TYPE_SUFIX, '-');
          addClassImport(name, fileName);

          // CREATE TYPE - BODY PARAMS
          createTypeRequest(config, unitName + REQUEST_TYPE_SUFIX, groupName, url, bodyVariables);

        }

        // IMPORTS TYPE RESPONSE
        if (responseVariables && responseVariables.length) {
          // CREATE TYPE - RESPONSE
          createTypeResponse(config, unitName, groupName, responseVariables);

          addClassImport(unitNameFirstUpper, typeFileName);
        }

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
    fs.writeFileSync( config.outDir.path + SLASH + config.outDir.dirNameServices + SLASH + serviceFileName, contentService, 'utf8');

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
  recurse(node, [{name: 'element', value: HTTP_REQUEST}], null, resultHttpRequest);
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
  const type: string = node && node.content && node.content.value && node.content.value.element ? node.content.value.element : '';
  // const structureType: string = getTypeName(type, structures);
  return type;
}

function getPropertyRequired(node: any): boolean {
  return node && node.attributes && node.attributes.typeAttributes && node.attributes.typeAttributes.indexOf(REQUIRED) > -1;
}

function getTypeName(value: string, structures: Structure[]): string {
  const type: Structure = structures.filter(item => item.code === value)[0];
  return type ? type.name : value;
}

function getDataStructures(content: any): DataStructure[] {
  const resultDataStructures: Result = {values: []};
  const result: Structure[] = [];
  recurse(content, [{name: 'element', value: CATEGORY}], DATA_STRUCTURES, resultDataStructures);
  // console.log(JSON.stringify(resultDataStructures));

  if (resultDataStructures.values[0]) {
    const types: DataStructure[] = resultDataStructures.values[0].content;
    // ONE TYPE
    /*types.forEach((item: DataStructure) => {
      // PROPERTIES
      item.content.forEach((prop) => {
        result.push({
          code: prop.meta.id.content,
          name: prop.meta.
        });
      });
    });*/
  }

  // createType();
  return resultDataStructures.values[0] ? resultDataStructures.values[0].content : [];
}

function getMethodParams(unitName, params: Param[], queryParams: Param[], bodyVariables: Param[]): string {
  const templateMethodParams: string = String(fs.readFileSync('src/templates/http-method-params.ts'));
  const templateMethodRequest: string = String(fs.readFileSync('src/templates/http-method-request.ts'));
  let result;
  let paramsString = '';
  let queryParamsString = '';
  let bodyParamsString = '';

  // PARAMS
  if (params && params.length > 0) {
    paramsString = params.map((param, i) => {
      if (param) {
        return (i === 0 ? '' : COMMA) + param.name + ': ' + param.type;
      } else {
        return '';
      }
    }).join('');
  }

  // QUERY PARAMS
  if (queryParams && queryParams.length > 0) {
    //  console.log('AAAAAAAAAAAAAAA');
    //  console.log(JSON.stringify(queryParams));
    queryParamsString = (paramsString ? COMMA + TAB1 : '') + templateMethodRequest
      .replace(/\r?\n|\r/g, '')
      .replace(/@@PARAM_NAME@@/g, bodyVariables && bodyVariables.length > 0 ? METHOD_PARAM_NAME_FOR_QUERY : METHOD_PARAM_NAME)
      .replace(/@@METHOD_NAME_FIRST_UP@@/g, firstUp(unitName))
      .replace(/@@REQUEST_TYPE_SUFIX@@/g, REQUEST_TYPE_SUFIX);
  }

  // BODY PARAMS
  if (bodyVariables && bodyVariables.length > 0) {
    //  console.log('BBBBBBBBBBBBBBBB');
    //  console.log(JSON.stringify(bodyVariables));
    bodyParamsString = (paramsString || queryParamsString ? COMMA + TAB1 : '') + templateMethodRequest
      .replace(/\r?\n|\r/g, '')
      .replace(/@@PARAM_NAME@@/g, queryParams && queryParams.length > 0 ? METHOD_PARAM_NAME_FOR_BODY : METHOD_PARAM_NAME)
      .replace(/@@METHOD_NAME_FIRST_UP@@/g, firstUp(unitName))
      .replace(/@@REQUEST_TYPE_SUFIX@@/g, REQUEST_TYPE_SUFIX);
  }

  result = templateMethodParams
    .replace(/\r?\n|\r/g, '')
    .replace(/@@SIMPLE_PARAMS@@/g, paramsString)
    .replace(/@@REQUEST_PARAMS@@/g, queryParamsString)
    .replace(/@@REQUEST_BODY@@/g, bodyParamsString);

  return result;
}

function getHrefVariables(node: any, structures: Structure[]): Param[] {
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

function getBodyVariables(node: any, structures: Structure[]): Param[] {
  const httpRequest: Result = {values: []};
  const dataStructure: Result = {values: []};
  const variables: any[] = [];
  recurse(node, [{name: 'element', value: HTTP_REQUEST}], null, httpRequest);
  recurse(httpRequest, [{name: 'element', value: DATA_STRUCTURE}], null, dataStructure);

  if (dataStructure.values[0] && dataStructure.values[0].content && dataStructure.values[0].content[0]) {
    dataStructure.values[0].content[0].content.forEach((variable) => {
      variables.push({
        name: getPropertyName(variable),
        type: getPropertyType(variable),
        required: getPropertyRequired(variable)
      });
    });
  }

  return variables || [];
}

function getResponseVariables(node: any, structures: Structure[]): Param[] {
  const httpResponse: Result = {values: []};
  const dataStructure: Result = {values: []};
  const variables: Param[] = [];
  recurse(node, [{name: 'element', value: HTTP_RESPONSE}], null, httpResponse);
  recurse(httpResponse, [{name: 'element', value: DATA_STRUCTURE}], null, dataStructure);

  if (dataStructure.values[0] && dataStructure.values[0].content && dataStructure.values[0].content[0]) {
    dataStructure.values[0].content[0].content.forEach((variable) => {
      // FIND REF TYPE
      // TODO:
      const type: string = getPropertyType(variable);
      const refType = getType(type);
      if (refType) {
        variables.push(refType);
      } else {
        variables.push({
          name: getPropertyName(variable),
          type: type,
          required: getPropertyRequired(variable)
        });
      }
    });
  }

  return variables || [];
}

function createTypeRequest(config: Config, name: string, groupName: string, url: string, params: Param[]) {
  const templateInterfaceProperty: string = String(fs.readFileSync('src/templates/interface-property.ts'));
  const templateInterface: string = String(fs.readFileSync('src/templates/interface.ts'));
  const typeFileNameRequest = decamelize(name, '-') + FILE_EXT;
  let contentTypeRequest: string;
  let properties = '';

  if (params) {
    params.forEach((param: Param) => {
      if (properties) {
        properties += EOF + TAB2;
      }
      properties += templateInterfaceProperty
        .replace(EOF, '')
        .replace(/@@KEY@@/g, param.name)
        .replace(/@@REQUIRED@@/g, param.required ? '' : NO_REQUIRED_CHAR)
        .replace(/@@VALUE@@/g, param.type);
    });
  }

  if (properties) {
    contentTypeRequest = templateInterface
      .replace(/@@INTERFACE_NAME@@/g, firstUp(name))
      .replace(/@@PROPERTIES@@/g, properties);
  }

  /// SAVE TYPE TO FILE
  if (contentTypeRequest) {
    fs.writeFileSync(config.outDir.path + SLASH + config.outDir.dirNameTypes + SLASH + decamelize(groupName, '-') + SLASH +
      typeFileNameRequest, contentTypeRequest, 'utf8');
  }
}

function createTypeResponse(config: Config, unitName: string, groupName: string, params: Param[]) {
  const templateInterfaceProperty: string = String(fs.readFileSync('src/templates/interface-property.ts'));
  const templateInterface: string = String(fs.readFileSync('src/templates/interface.ts'));
  const typeFileName = decamelize(unitName, '-') + FILE_EXT;
  let contentTypeResponse: string;
  let properties = '';

  if (params) {
    params.forEach((param) => {
      if (properties) {
        properties += EOF + TAB2;
      }
      properties += templateInterfaceProperty
        .replace(EOF, '')
        .replace(/@@KEY@@/g, param.name)
        .replace(/@@REQUIRED@@/g, param.required ? '' : NO_REQUIRED_CHAR)
        .replace(/@@VALUE@@/g, param.type);
    });
  }

  if (properties) {
    contentTypeResponse = templateInterface
      .replace(/@@INTERFACE_NAME@@/g, firstUp(unitName))
      .replace(/@@PROPERTIES@@/g, properties);
  }

  /// SAVE TYPE TO FILE
  if (contentTypeResponse) {
    fs.writeFileSync(config.outDir.path + SLASH + config.outDir.dirNameTypes + SLASH + decamelize(groupName, '-') + SLASH +
      typeFileName, contentTypeResponse, 'utf8');
  }
}

function getTypes(ds: DataStructure[]): Structure[] {
  const result: Structure[] = [];
  ds.forEach((data) => {
    result.push(getType(data));
  });
  return result;
}

function getType(type: string, structure: DataStructure): Structure {
  const result: Structure = {
    code: structure.content[0].meta.id.content,
    name: firstUp(camelCase(structure.content[0].meta.id.content))
  };
  return result;
}

function createTypeFiles(structure: Structure[], config: Config) {
  const typeFileName = '';
  const content = '';
  if (content) {
    fs.writeFileSync(config.outDir.path + SLASH + config.outDir.dirNameTypes + SLASH +
      typeFileName, content, 'utf8');
  }
}

function getQueryParamsFromUrl(url: string, variables: Param[], config: Config): Param[] {
  const posPrefix = url.indexOf(URL_QUERY_PARAMS_PREFIX);
  let params: string[] = [];
  const paramsType: Param[] = [];
  if (posPrefix > -1) {
    const fragment = url.substr(posPrefix + URL_QUERY_PARAMS_PREFIX.length);
    const posSufix = fragment.indexOf(URL_PARAMS_SUFIX);
    params = fragment.substr(0, posSufix)
      .split(COMMA);
  }
  params.forEach(item => {
    const find: Param = variables.filter(variable => variable.name === item)[0];
    if (find || config.generateParamIfNoExistTypeDeclaration) {
      paramsType.push({
        name: item,
        type: find ? find.type : TypesEnum.ANY,
        required: find ? find.required : false
      });
    }
  });

  return paramsType || [];
}

function getParamsFromUrl(url: string, variables: Param[]): Param[] {
  const posPrefix: number = url.indexOf(URL_QUERY_PARAMS_PREFIX);
  const fragment: string = posPrefix > -1 ? url.substr(0, posPrefix) : url;
  const params: Param[] = [];
  (fragment ? fragment.split(URL_PARAMS_PREFIX) : []).forEach((item) => {
    if (item.indexOf(URL_PARAMS_SUFIX) > -1) {
      const propertyName = item.split(URL_PARAMS_SUFIX)[0];
      const prop: Param = variables.filter((variable) => variable.name === propertyName)[0];
      params.push({
        name: propertyName,
        type: prop ? prop.type : TypesEnum.ANY,
        required: prop ? prop.required : false
      });
    }
  });
  return params;
}

function getParam(key: string, params: Param[]): Param {
  return params.filter((param) => param.name === key)[0];
}

function getHttpMethodSecondParam(methodType: string, queryParams: Param[], bodyParams: Param[]): string {
  let result = '';
  const emptyParam = ', {}';
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
    } else {
      result = emptyParam;
    }
  }

  return result;
}

function getHttpMethodThirdParam(methodType: string, queryParams: Param[], bodyParams: Param[]): string {
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
  generateParamIfNoExistTypeDeclaration: boolean;
}

interface Param {
  name: string;
  type: TypesEnum | string;
  required?: boolean;
}

enum TypesEnum {
  ANY = 'any',
  STRING = 'string',
  NUMBER = 'number',
  ARRAY = '<T>[]',
  BOOLEAN = 'boolean'
}

interface DataStructure {
  element: string;
  content: {
    element: string;
    meta: {
      id: {
        element: string;
        attributes: any;
        content: string;
      };
      decription?: {
        element: string;
        attributes: any;
        content: string;
      }
    };
    content: {
      element: string;
      meta: {
        description: string;
      };
      attributes?: {
        typeAttributes: string[];
      };
      content: {
        key: {
          element: string;
          attributes: any;
          content: string;
        };
        value: {
          element: string;
          attributes: any;
          content: string;
        };
      }
    }[]
  }[];
}

interface Structure {
  code: string;
  name: string;
}
