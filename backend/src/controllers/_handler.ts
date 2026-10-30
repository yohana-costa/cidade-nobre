import { Request, Response, NextFunction } from 'express';

// Controller fino: chama o service e devolve JSON. Erros seguem para o errorHandler.
export const h =
  <R extends Request>(fn: (req: R, res: Response) => Promise<unknown>, status = 200) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req as R, res)
      .then((out) => {
        if (!res.headersSent) res.status(status).json(out);
      })
      .catch(next);
  };
