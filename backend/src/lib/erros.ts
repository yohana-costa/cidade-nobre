// Erro de negocio com status HTTP. O errorHandler devolve a mensagem para a tela.
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const falha = (status: number, message: string) => new HttpError(status, message);
