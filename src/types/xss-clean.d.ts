declare module 'xss-clean' {
  import type { RequestHandler } from 'express';
  const xssClean: () => RequestHandler;
  export default xssClean;
}
