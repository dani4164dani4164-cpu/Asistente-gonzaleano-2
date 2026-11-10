/* Cerebro por defecto: todavía no hay ninguno conectado.
   No responde y no envía nada (ni una sola petición de red). */
import { ErrorCerebro } from './index.js';

export default {
  id: 'sin-conectar',
  nombre: 'Sin conectar',
  envia: false,
  aviso: 'no se enviará nada',
  async responder() {
    throw new ErrorCerebro('no-conectado', 'Dominus nostrum todavía no tiene un cerebro conectado.');
  },
};
