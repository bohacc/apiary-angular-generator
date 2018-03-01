public @@METHOD_TYPE@@@@METHOD_NAME@@(request: @@METHOD_TYPE_UPPER@@@@METHOD_NAME@@Request): Observable<@@METHOD_NAME@@> {
    const params: HttpParams = HttpUtils.convertToParams(request);
    return this.httpClient.get<@@METHOD_NAME@@>(@@URL_PROP_NAME@@, {params: params})
      .catch(HttpUtils.handleHttpError);
  }
