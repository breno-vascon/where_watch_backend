export const DATABASE_HEALTH = Symbol('DATABASE_HEALTH');

export interface DatabaseHealthPort {
  /** true se o banco respondeu a uma consulta simples. Nunca lança. */
  ping(): Promise<boolean>;
}
