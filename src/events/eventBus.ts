import { EventEmitter } from 'events';

class PlatformEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100);
  }
}

export const eventBus = new PlatformEventBus();
export { PlatformEventBus };
