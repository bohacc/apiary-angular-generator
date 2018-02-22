import {Component, OnInit} from '@angular/core';
import {HttpClient} from '@angular/common/http';
// import Drafter from 'drafter.js';
// import Drafter from 'drafter.js';
// import * as ts from 'typescript';

declare var drafter: any;

const RESOURCE_GROUP = 'resourceGroup';
const RESOURCE = 'resource';
const CATEGORY = 'category';
const META = 'meta';
const CLASSES = 'classes';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'app';
  content: any;

  constructor(
    private http: HttpClient
  ) {

  }

  ngOnInit() {
    this.http.get('assets/apiary/apiary.txt', {responseType: 'text'})
      .subscribe((file) => {
        const fileFormat = String(file).replace(/\r?\n|\r/g, '\n');
        drafter.parse(fileFormat, {generateSourceMap: true}, (err, res) => {
          if (err) {
            console.log(err);
          }
          console.log(res);
          this.content = res;
          this.getResourceGroup(this.content);
        });
    });

    /*const res = drafter.validate('# API Blueprint...', {requireBlueprintname: true}, function (err, res) {
      if (err) {
        console.log(err);
      }

      if (res) {
        console.log('Document has semantic issues!');
        console.log(res);
      } else {
        console.log(err);
        console.log(res);
        console.log('Document is valid with no warnings.');
      }
    });
    console.log(res);*/

    /*const text = this.http.get('assets/apiary/apiary.txt', {responseType: 'text'})
      .subscribe((file) => {
        const fileFormat = String(file).trim();
        console.log(fileFormat);
        console.log(fileFormat === '# API Blueprint...');
        this.content = drafter.parse(fileFormat, {generateSourceMap: true, json: false}); // , () => {}
        console.log(this.content);
        // this.getResourceGroup(this.content);
      });*/
    // const sourceFile = ts.createSourceFile('./test.tct', '', ts.ScriptTarget.ES2015, true);
    // console.log(sourceFile);
  }

  private recurse(content: any, nodes: Node[], meta: string, result: Result) {
    if (Array.isArray(content)) {
      content.forEach((item) => {
        this.recurse(item, nodes, meta, result);
      });
    } else {
      if (typeof content === 'object' && content !== null) {
        if (this.existNodes(content, nodes) &&
          ((meta && content[META] && content[META][CLASSES] && content[META][CLASSES][0] === meta) || !meta)
        ) {
          result.values.push(content);
        } else {
          for (const key in content) {
            if (!content.hasOwnProperty(key)) {
              continue;
            }
            this.recurse(content[key], nodes, meta, result);
          }
        }
      } else {
        console.log();
      }
    }
  }

  private getResourceGroup(content) {
    const result: Result = {values: []};
    this.recurse(content, [{name: 'element', value: CATEGORY}], RESOURCE_GROUP, result);
    console.log(result);

    result.values.forEach((item) => {
      const result2: Result = {values: []};
      console.log('*******************');
      console.log(this.getTitle(item));
      console.log('*******************');
      // console.log(result2);
      this.recurse(item, [{name: 'element', value: RESOURCE}], null, result2);
      result2.values.forEach((item2) => {
        console.log(this.getTitle(item2));
        console.log(this.getHref(item2));
      });
      console.log('/////////////////////////');
    });
    // console.log(this.getTitle(result.value));
    /*result.values.forEach((value) => {
      console.log('*******************************');
      console.log(this.getTitle(value));
      console.log('*******************************');
      value.content.forEach((contentNode1) => {
        console.log(this.getTitle(contentNode1));
        console.log(this.getHref(contentNode1));
        contentNode1.content.forEach((contentNode2) => {
          // console.log(contentNode2.meta.title);
          console.log(this.getTitle(contentNode2));
          console.log(this.getHref(contentNode2));
          // console.log(contentNode2);
          if (contentNode2.attributes) {
            const variables = contentNode2.attributes.hrefVariables;
            console.log(variables);
            if (variables && variables.content) {
              variables.content.forEach((variable) => {
                if (variable.attributes && variable.attributes.typeAttributes) {
                  console.log(variable.attributes.typeAttributes[0]);
                }
                if (variable.content) {
                  console.log(variable.content.key.content);
                  console.log(variable.content.value.element);
                  console.log('-------PARAM------');
                }
              });
            }
          }
        });
      });
    });*/
  }

  private getTitle(node: any): string {
    return node && node.meta && node.meta.title ? node.meta.title.content : null;
  }

  private getHref(node: any): string {
    return node && node.attributes && node.attributes.href ? node.attributes.href.content : null;
  }

  private existNodes(obj: any, nodes: Node[]): boolean {
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
}

interface Node {
  name: string;
  value: string;
}

interface Result {
  values: any[];
}

/*interface Content {
  attributes: {
    typeAttributes: string[];
  },
  content: ContentItem,
  element: string;
  meta: Meta;
}

interface ContentItem {

}*/
