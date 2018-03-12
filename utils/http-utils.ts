import { HttpErrorResponse, HttpParams } from '@angular/common/http';
import { ErrorObservable } from 'rxjs/observable/ErrorObservable';
import { Observable } from 'rxjs/Observable';

export class HttpUtils {

  public static convertToParams(request: any): HttpParams {
    let params: HttpParams = new HttpParams();
    if (request) {
      Object.keys(request).forEach(key => {
        if (request[key] !== null && request[key] !== undefined) {
          params = params.set(key, request[key]);
        }
      });
    }
    return params;
  }

  public static handleHttpError(err: HttpErrorResponse): ErrorObservable {
    return Observable.throw(err);
  }

}
