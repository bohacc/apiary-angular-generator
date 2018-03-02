  public @@HTTP_METHOD_PREFIX@@@@METHOD_NAME@@(request: @@METHOD_NAME_FIRST_UP@@@@REQUEST_TYPE_SUFIX@@): Observable<@@METHOD_NAME_FIRST_UP@@> {
    const params: HttpParams = HttpUtils.convertToParams(request);
    return this.httpClient.@@HTTP_METHOD@@<@@METHOD_NAME_FIRST_UP@@>(@@URL_PROP_NAME@@, {params: params})@@END_OF_METHOD@@
  }
