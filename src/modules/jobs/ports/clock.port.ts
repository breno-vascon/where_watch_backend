export const CLOCK = Symbol('CLOCK');

/** Abstrai o relógio para os testes controlarem o "agora". */
export interface ClockPort {
  now(): Date;
}
