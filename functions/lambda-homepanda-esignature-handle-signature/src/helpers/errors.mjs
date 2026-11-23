export class StepError extends Error {
  constructor(message, extra = {}) {
    super(message);
    this.extra = extra;
  }
}
