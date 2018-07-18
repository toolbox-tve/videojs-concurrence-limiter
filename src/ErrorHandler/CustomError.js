import errorMessages from './errors.json';

export default class CustomError extends Error {
  constructor(code, message, ...params) {
    super(...params);

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CustomError);
    }

    this.code = code;
    this.message = errorMessages[code];
    this.name = 'CustomError';
  }

  static parseError(error) {
    if(!error.code) {
      return new CustomError(ErrorCodes.noConnection);
    }

    switch(error.code) {
      case 20: return new CustomError(ErrorCodes.noConnection);
    }
  }
}

export const ErrorCodes = {
  deniedConcurrence: 'CL-001',
  noConnection: 'CL-002'
};
