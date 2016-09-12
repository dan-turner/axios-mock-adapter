'use strict';

var axios = require('axios');
var deepEqual = require('deep-equal');

function eql(a, b) {
  return deepEqual(a, b, { strict: true });
}

// < 0.13.0 will not have default headers set on a custom instance
var rejectWithError = !!axios.create().defaults.headers;

function find(array, predicate) {
  var length = array.length;
  for (var i = 0; i < length; i++) {
    var value = array[i];
    if (predicate(value)) return value;
  }
}

function findHandler(handlers, method, url, body) {
  return find(handlers[method.toLowerCase()], function(handler) {
    if (typeof handler[0] === 'string') {
      return url === handler[0] && isBodyMatching(url, body, handler[4]);
    } else if (handler[0] instanceof RegExp) {
      return handler[0].test(url) && isBodyMatching(url, body, handler[4]);
    }
  });
}

function isBodyMatching(url, body, requiredBody) {
  if (requiredBody === undefined) {
    return true;
  }
  var parsedBody;
  try {
    parsedBody = JSON.parse(body);
  } catch (e) { }
  if(typeof requiredBody === 'function') {
    return requiredBody(parsedBody, url);
  }
  return parsedBody ? eql(parsedBody, requiredBody) : eql(body, requiredBody);
}

function purgeIfReplyOnce(mock, handler) {
  var index = mock.replyOnceHandlers.indexOf(handler);
  if (index > -1) {
    mock.replyOnceHandlers.splice(index, 1);

    Object.keys(mock.handlers).forEach(function(key) {
      index = mock.handlers[key].indexOf(handler);
      if (index > -1) {
        mock.handlers[key].splice(index, 1);
      }
    });
  }
}

function settle(resolve, reject, response, delay) {
  if (delay > 0) {
    setTimeout(function() {
      settle(resolve, reject, response);
    }, delay);
    return;
  }

  if (response.config && response.config.validateStatus) {
    response.config.validateStatus(response.status)
      ? resolve(response)
      : reject(createErrorResponse(
        'Request failed with status code ' + response.status,
        response.config,
        response
      ));
    return;
  }

  // Support for axios < 0.11
  if (response.status >= 200 && response.status < 300) {
    resolve(response);
  } else {
    reject(response);
  }
}

function createErrorResponse(message, config, response) {
  // Support for axios < 0.13.0
  if (!rejectWithError) return response;

  var error = new Error(message);
  error.config = config;
  error.response = response;
  return error;
}

module.exports = {
  findHandler: findHandler,
  purgeIfReplyOnce: purgeIfReplyOnce,
  settle: settle
};
