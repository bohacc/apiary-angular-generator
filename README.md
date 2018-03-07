### APIARY GENERATOR DTO PRO ANGULAR

adresa pro seznam dostupných projektu pod apiary (JSON) 
https://enterprise-integrations.apiary.io/api-projects

pro konkretni schema se pouzije (5988516e662b74070026fbde hash projektu):
https://enterprise-integrations.apiary.io/api-projects/5988516e662b74070026fbde/add

```
add conf file to root dir apiary.conf.json:
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
```
