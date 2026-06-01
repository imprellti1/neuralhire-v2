export function createTestResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    finished: false,
    setHeader(key, value) {
      this.headers[String(key).toLowerCase()] = value;
    },
    writeHead(statusCode, headers = {}) {
      this.statusCode = statusCode;
      for (const [k, v] of Object.entries(headers)) {
        this.setHeader(k, v);
      }
    },
    end(payload = '') {
      this.body = payload;
      this.finished = true;
    }
  };
}
