import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs/Observable';
@@IMPORTS@@

@@URL_CONSTS@@

@Injectable()
export class @@CLASS_NAME@@Service {

  constructor(private httpClient: HttpClient) {
  }

@@HTTP_METHOD@@
}
