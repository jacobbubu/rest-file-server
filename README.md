# @jacobbubu/rest-file-server

[![Build Status](https://github.com/jacobbubu/rest-file-server/workflows/Build%20and%20Release/badge.svg)](https://github.com/jacobbubu/rest-file-server/actions?query=workflow%3A%22Build+and+Release%22)
[![Coverage Status](https://coveralls.io/repos/github/jacobbubu/rest-file-server/badge.svg)](https://coveralls.io/github/jacobbubu/rest-file-server)
[![npm](https://img.shields.io/npm/v/@jacobbubu/rest-file-server.svg)](https://www.npmjs.com/package/@jacobbubu/rest-file-server/)

> A test file upload server.

## Intro.

This tool was modified from [express-rest-file-server](https://github.com/bitIO/express-rest-file-server), but I made the following revisions:

  - Only support memory storage.
  - File uploads can be speed limited.

## Usage

```bash
npm install @jacobbubu/rest-file-server
```

### Upload and Download

``` bash
curl -X POST -F "file=@README.md" http://localhost:8080/files
```

THEN get it back,

``` bash
curl http://localhost:8080/files/README.md
```

Please see test cases for more usage.
